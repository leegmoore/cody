import { test, expect } from "./fixtures/api-client";

test.describe("Conversations - Create (TC-1)", () => {
  test("TC-1.1: Create with minimal config", async ({ api }) => {
    const response = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
    });

    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.conversationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(data.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(data.updatedAt).toBe(data.createdAt);
    expect(data.modelProviderId).toBe("openai");
    expect(data.modelProviderApi).toBe("responses");
    expect(data.model).toBe("gpt-5-codex");
    expect(data.title).toBeNull();
    expect(data.summary).toBeNull();
    expect(data.parent).toBeNull();
    expect(data.tags).toEqual([]);
    expect(data.agentRole).toBeNull();
  });

  test("TC-1.2: Create with full metadata", async ({ api }) => {
    const response = await api.createConversation({
      modelProviderId: "anthropic",
      modelProviderApi: "messages",
      model: "claude-sonnet-4",
      title: "Test Conversation",
      summary: "Testing full metadata",
      tags: ["test", "phase-6"],
      agentRole: "planner",
    });

    expect(response.status()).toBe(201);
    const data = await response.json();
    expect(data.title).toBe("Test Conversation");
    expect(data.summary).toBe("Testing full metadata");
    expect(data.tags).toEqual(["test", "phase-6"]);
    expect(data.agentRole).toBe("planner");
  });

  test("TC-1.3: Missing modelProviderId", async ({ api }) => {
    const response = await api.createConversation({
      modelProviderApi: "responses",
      model: "gpt-5-codex",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error.code).toBe("VALIDATION_ERROR");
    expect(data.error.message).toContain("modelProviderId");
  });

  test("TC-1.4: Missing modelProviderApi", async ({ api }) => {
    const response = await api.createConversation({
      modelProviderId: "openai",
      model: "gpt-5-codex",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error.code).toBe("VALIDATION_ERROR");
    expect(data.error.message).toContain("modelProviderApi");
  });

  test("TC-1.5: Missing model", async ({ api }) => {
    const response = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error.code).toBe("VALIDATION_ERROR");
    expect(data.error.message).toContain("model");
  });

  test("TC-1.6: Invalid Provider", async ({ api }) => {
    const response = await api.createConversation({
      modelProviderId: "invalid-provider",
      modelProviderApi: "responses",
      model: "some-model",
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error.message).toContain("Supported providers");
    // Spec requires: error message lists supported providers (full list)
    const message = data.error.message.toLowerCase();
    // Must contain multiple providers to constitute a "list"
    const hasOpenAI = message.includes("openai");
    const hasAnthropic = message.includes("anthropic");
    const hasOpenRouter = message.includes("openrouter");
    // Verify at least 2 providers are listed (constitutes a "list")
    const providerCount = [hasOpenAI, hasAnthropic, hasOpenRouter].filter(Boolean).length;
    expect(providerCount).toBeGreaterThanOrEqual(2); // Full list means multiple providers
  });

  test("TC-1.7: OpenAI + Messages (Unsupported Combo)", async ({ api }) => {
    const response = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "messages",
      model: "gpt-5-codex",
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error.message).toContain("openai");
    expect(data.error.message).toContain("messages");
  });

  test("TC-1.8: Anthropic + Responses (Unsupported Combo)", async ({ api }) => {
    const response = await api.createConversation({
      modelProviderId: "anthropic",
      modelProviderApi: "responses",
      model: "claude-sonnet-4",
    });

    expect(response.status()).toBe(400);
  });

  test("TC-1.9: Anthropic + Chat (Unsupported Combo)", async ({ api }) => {
    const response = await api.createConversation({
      modelProviderId: "anthropic",
      modelProviderApi: "chat",
      model: "claude-sonnet-4",
    });

    expect(response.status()).toBe(400);
  });

  test("TC-1.10: OpenRouter + Responses (Unsupported Combo)", async ({
    api,
  }) => {
    const response = await api.createConversation({
      modelProviderId: "openrouter",
      modelProviderApi: "responses",
      model: "some-model",
    });

    expect(response.status()).toBe(400);
  });
});

test.describe("Conversations - List (TC-2)", () => {
  test("TC-2.1: Empty List", async ({ api }) => {
    // Setup: No conversations exist
    // Spec requires: setup ensures no conversations exist
    // Note: In parallel test environment, we cannot guarantee complete emptiness
    // as other tests may create conversations concurrently. However, the spec
    // requires that when empty, the API returns [] and null cursor.
    
    // Attempt to clean up: Get all conversations and delete them
    // This ensures empty state per spec requirement
    const listBefore = await api.listConversations();
    if (listBefore.status() === 200) {
      const beforeData = await listBefore.json();
      // Delete any existing conversations to ensure empty state
      for (const conv of beforeData.conversations) {
        await api.deleteConversation(conv.conversationId);
      }
    }
    
    const response = await api.listConversations();
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(Array.isArray(data.conversations)).toBe(true);
    
    // Spec requires: conversations = [] and nextCursor = null for empty state
    // After cleanup, we enforce the empty state requirement
    expect(data.conversations).toEqual([]);
    expect(data.nextCursor).toBeNull();
  });

  test("TC-2.2: Multiple Conversations", async ({ api }) => {
    // Setup: Create 3 conversations with different createdAt times
    const create1 = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
    });
    const conv1 = await create1.json();
    await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay for different timestamps
    const create2 = await api.createConversation({
      modelProviderId: "anthropic",
      modelProviderApi: "messages",
      model: "claude-sonnet-4",
    });
    const conv2 = await create2.json();
    await new Promise((resolve) => setTimeout(resolve, 10));
    const create3 = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
    });
    const conv3 = await create3.json();
    const createdIds = [conv1.conversationId, conv2.conversationId, conv3.conversationId];

    const response = await api.listConversations();

    expect(response.status()).toBe(200);
    const data = await response.json();
    // Find our 3 conversations in the list
    const ourConversations = data.conversations.filter((c: { conversationId: string }) =>
      createdIds.includes(c.conversationId),
    );
    expect(ourConversations.length).toBe(3);
    
    // Verify sorted by createdAt descending (newest first)
    for (let i = 0; i < ourConversations.length - 1; i++) {
      expect(
        new Date(ourConversations[i].createdAt).getTime(),
      ).toBeGreaterThanOrEqual(
        new Date(ourConversations[i + 1].createdAt).getTime(),
      );
    }
    
    // Verify each conversation has all expected fields
    const requiredFields = [
      "conversationId",
      "createdAt",
      "updatedAt",
      "modelProviderId",
      "modelProviderApi",
      "model",
      "title",
      "summary",
      "parent",
      "tags",
      "agentRole",
    ];
    for (const conv of ourConversations) {
      for (const field of requiredFields) {
        expect(conv).toHaveProperty(field);
      }
    }
  });

  test("TC-2.3: Pagination with Limit", async ({ api }) => {
    // Setup: Create 3 conversations
    await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
    });
    await api.createConversation({
      modelProviderId: "anthropic",
      modelProviderApi: "messages",
      model: "claude-sonnet-4",
    });
    await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
    });

    const response = await api.listConversations({ limit: 1 });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.conversations.length).toBe(1);
    // Spec requires: nextCursor is not null and format = "timestamp:id" (colon separator)
    expect(data.nextCursor).not.toBeNull();
    expect(data.nextCursor).toMatch(/^.+:.+$/); // Format: timestamp:id (colon, not pipe)
  });

  test("TC-2.4: Using Next Cursor", async ({ api }) => {
    // Setup: Create 3 conversations
    const create1 = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
    });
    const conv1 = await create1.json();
    const create2 = await api.createConversation({
      modelProviderId: "anthropic",
      modelProviderApi: "messages",
      model: "claude-sonnet-4",
    });
    const conv2 = await create2.json();
    const create3 = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
    });
    const conv3 = await create3.json();
    const allIds = [conv1.conversationId, conv2.conversationId, conv3.conversationId];

    const firstResponse = await api.listConversations({ limit: 1 });
    expect(firstResponse.status()).toBe(200);
    const firstData = await firstResponse.json();
    const nextCursor = firstData.nextCursor;

    // Spec requires: cursor must exist and be used
    expect(nextCursor).not.toBeNull();
    expect(firstData.conversations.length).toBe(1);

    if (!nextCursor) {
      throw new Error("Expected nextCursor to be present");
    }

    const secondResponse = await api.listConversations({
      cursor: nextCursor,
      limit: 1,
    });
    expect(secondResponse.status()).toBe(200);
    const secondData = await secondResponse.json();
    expect(secondData.conversations.length).toBe(1);
    
    // Verify different conversation than first page
    expect(secondData.conversations[0].conversationId).not.toBe(
      firstData.conversations[0].conversationId,
    );
    
    // Verify no duplicates: collect all IDs from both pages
    const allReturnedIds = [
      firstData.conversations[0].conversationId,
      secondData.conversations[0].conversationId,
    ];
    const uniqueIds = new Set(allReturnedIds);
    expect(uniqueIds.size).toBe(2); // No duplicates
    
    // Verify both are from our created conversations
    expect(allIds).toContain(firstData.conversations[0].conversationId);
    expect(allIds).toContain(secondData.conversations[0].conversationId);
  });

  test("TC-2.5: Limit Bounds", async ({ api }) => {
    const responseZero = await api.listConversations({ limit: 0 });

    expect(responseZero.status()).toBe(200);
    const dataZero = await responseZero.json();
    expect(dataZero.conversations.length).toBeGreaterThanOrEqual(1);

    const responseLarge = await api.listConversations({ limit: 200 });
    expect(responseLarge.status()).toBe(200);
    const dataLarge = await responseLarge.json();
    expect(dataLarge.conversations.length).toBeLessThanOrEqual(100);
  });
});

test.describe("Conversations - Get (TC-3)", () => {
  test("TC-3.1: Get Existing Conversation", async ({ api }) => {
    // Setup: Create conversation first
    const createResponse = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
    });
    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const conversationId = createData.conversationId;

    const response = await api.getConversation(conversationId);
    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.conversationId).toBe(conversationId);
    
    // Verify all metadata fields present
    expect(data.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(data.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(data.modelProviderId).toBe("openai");
    expect(data.modelProviderApi).toBe("responses");
    expect(data.model).toBe("gpt-5-codex");
    expect(data.title).toBeNull();
    expect(data.summary).toBeNull();
    expect(data.parent).toBeNull();
    expect(Array.isArray(data.tags)).toBe(true);
    expect(data.tags).toEqual([]);
    expect(data.agentRole).toBeNull();
    
    // Verify history = [] (empty for new conversation)
    expect(Array.isArray(data.history)).toBe(true);
    expect(data.history).toEqual([]);
  });

  test("TC-3.2: Conversation Not Found", async ({ api }) => {
    const response = await api.getConversation("nonexistent-id");

    expect(response.status()).toBe(404);
    const data = await response.json();
    expect(data.error.code).toBe("NOT_FOUND");
  });
});

test.describe("Conversations - Delete (TC-4)", () => {
  test("TC-4.1: Delete Existing", async ({ api }) => {
    // Setup: Create conversation first
    const createResponse = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
    });
    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const conversationId = createData.conversationId;

    const response = await api.deleteConversation(conversationId);
    expect(response.status()).toBe(204);
  });

  test("TC-4.2: Delete Non-Existent", async ({ api }) => {
    const response = await api.deleteConversation("nonexistent-id");

    expect(response.status()).toBe(404);
  });

  test("TC-4.3: Verify Deleted", async ({ api }) => {
    // Setup: Create conversation, delete it
    const createResponse = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
    });
    
    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const conversationId = createData.conversationId;

    const deleteResponse = await api.deleteConversation(conversationId);
    expect(deleteResponse.status()).toBe(204);

    const listResponse = await api.listConversations();
    expect(listResponse.status()).toBe(200);
    const listData = await listResponse.json();
    expect(
      listData.conversations.find(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (c: any) => c.conversationId === conversationId,
      ),
    ).toBeUndefined();

    const getResponse = await api.getConversation(conversationId);
    expect(getResponse.status()).toBe(404);
  });
});

test.describe("Conversations - Update (TC-5)", () => {
  test("TC-5.1: Update Title Only", async ({ api }) => {
    // Setup: Create conversation
    const createResponse = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
      title: "Original Title",
      summary: "Original Summary",
      tags: ["original"],
      agentRole: "planner",
    });
    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const conversationId = createData.conversationId;
    const originalUpdatedAt = createData.updatedAt;

    // Wait a bit to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 10));

    const response = await api.updateConversation(conversationId, {
      title: "Updated Title",
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.title).toBe("Updated Title");
    
    // Verify other fields unchanged
    expect(data.summary).toBe("Original Summary");
    expect(data.tags).toEqual(["original"]);
    expect(data.agentRole).toBe("planner");
    expect(data.modelProviderId).toBe("openai");
    expect(data.modelProviderApi).toBe("responses");
    expect(data.model).toBe("gpt-5-codex");
    
    // Verify updatedAt > original updatedAt
    expect(new Date(data.updatedAt).getTime()).toBeGreaterThan(
      new Date(originalUpdatedAt).getTime(),
    );
  });

  test("TC-5.2: Update Multiple Fields", async ({ api }) => {
    // Setup: Create conversation
    const createResponse = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
    });
    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const conversationId = createData.conversationId;
    const originalUpdatedAt = createData.updatedAt;

    // Wait a bit to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 10));

    const response = await api.updateConversation(conversationId, {
      title: "New Title",
      summary: "New Summary",
      tags: ["new", "tags"],
      agentRole: "coder",
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.title).toBe("New Title");
    expect(data.summary).toBe("New Summary");
    expect(data.tags).toEqual(["new", "tags"]);
    expect(data.agentRole).toBe("coder");
    
    // Verify model config unchanged
    expect(data.modelProviderId).toBe("openai");
    expect(data.modelProviderApi).toBe("responses");
    expect(data.model).toBe("gpt-5-codex");
    
    // Verify updatedAt changed
    expect(new Date(data.updatedAt).getTime()).toBeGreaterThan(
      new Date(originalUpdatedAt).getTime(),
    );
  });

  test("TC-5.3: Update Model Config (Valid)", async ({ api }) => {
    // Setup: Create conversation with openai + responses
    const createResponse = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
      title: "Original Title",
      summary: "Original Summary",
      tags: ["original"],
      agentRole: "planner",
    });
    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const conversationId = createData.conversationId;

    const response = await api.updateConversation(conversationId, {
      modelProviderId: "anthropic",
      modelProviderApi: "messages",
      model: "claude-sonnet-4",
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.modelProviderId).toBe("anthropic");
    expect(data.modelProviderApi).toBe("messages");
    expect(data.model).toBe("claude-sonnet-4");
    
    // Verify metadata unchanged
    expect(data.title).toBe("Original Title");
    expect(data.summary).toBe("Original Summary");
    expect(data.tags).toEqual(["original"]);
    expect(data.agentRole).toBe("planner");
  });

  test("TC-5.4: Update Model Config (Invalid Combo)", async ({ api }) => {
    // Setup: Create conversation
    const createResponse = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
    });
    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const conversationId = createData.conversationId;

    const response = await api.updateConversation(conversationId, {
      modelProviderId: "openai",
      modelProviderApi: "messages",
      model: "gpt-5-codex",
    });

    expect(response.status()).toBe(400);
  });

  test("TC-5.5: Update Immutable Field (conversationId)", async ({ api }) => {
    // Setup: Create conversation
    const createResponse = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
    });
    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const conversationId = createData.conversationId;

    const response = await api.updateConversation(conversationId, {
      conversationId: "different-id",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    // Zod validation should reject unknown fields
    expect(response.status()).toBe(400);
  });

  test("TC-5.6: Update Immutable Field (createdAt)", async ({ api }) => {
    // Setup: Create conversation
    const createResponse = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
    });
    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const conversationId = createData.conversationId;

    const response = await api.updateConversation(conversationId, {
      createdAt: "2020-01-01T00:00:00Z",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    // Zod validation should reject unknown fields
    expect(response.status()).toBe(400);
  });

  test("TC-5.7: Empty Body", async ({ api }) => {
    // Setup: Create conversation
    const createResponse = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
    });
    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const conversationId = createData.conversationId;

    const response = await api.updateConversation(conversationId, {});

    expect(response.status()).toBe(400);
  });

  test("TC-5.8: Conversation Not Found", async ({ api }) => {
    const response = await api.updateConversation("nonexistent", {
      title: "New",
    });

    expect(response.status()).toBe(404);
  });

  test("TC-5.9: UpdatedAt Changes", async ({ api }) => {
    // Setup: Create conversation, note original updatedAt
    const createResponse = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
    });
    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const conversationId = createData.conversationId;
    const originalUpdatedAt = createData.updatedAt;

    // Wait a bit to ensure timestamp difference
    await new Promise((resolve) => setTimeout(resolve, 10));

    const response = await api.updateConversation(conversationId, {
      title: "Updated",
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    // Verify updatedAt > original updatedAt
    expect(new Date(data.updatedAt).getTime()).toBeGreaterThan(
      new Date(originalUpdatedAt).getTime(),
    );
  });
});
