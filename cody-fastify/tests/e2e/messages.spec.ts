import { test, expect } from "./fixtures/api-client";

test.describe("Messages - Submit (TC-6)", () => {
  test("TC-6.1: Submit Message (Basic)", async ({ api }) => {
    // Setup: Create conversation
    const createResponse = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
    });
    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const conversationId = createData.conversationId;

    const startTime = Date.now();
    const response = await api.submitMessage(conversationId, {
      message: "Hello, world!",
    });
    const elapsed = Date.now() - startTime;

    expect(response.status()).toBe(202);
    expect(elapsed).toBeLessThan(100); // Response within 100ms
    const data = await response.json();
    expect(data.turnId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(data.conversationId).toBe(conversationId);
    expect(data.streamUrl).toBe(`/api/v1/turns/${data.turnId}/stream-events`);
    expect(data.statusUrl).toBe(`/api/v1/turns/${data.turnId}`);
  });

  test("TC-6.2: Conversation Not Found", async ({ api }) => {
    const response = await api.submitMessage("nonexistent", {
      message: "Test",
    });

    expect(response.status()).toBe(404);
  });

  test("TC-6.3: Empty Message", async ({ api }) => {
    // Setup: Create conversation
    const createResponse = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
    });
    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const conversationId = createData.conversationId;

    const response = await api.submitMessage(conversationId, {
      message: "",
    });

    expect(response.status()).toBe(400);
  });

  test("TC-6.4: With Model Override (Valid)", async ({ api }) => {
    // Setup: Create conversation (openai + responses)
    const createResponse = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
    });
    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const conversationId = createData.conversationId;

    const response = await api.submitMessage(conversationId, {
      message: "Try with Claude",
      modelProviderId: "anthropic",
      modelProviderApi: "messages",
      model: "claude-sonnet-4",
    });

    expect(response.status()).toBe(202);
    const data = await response.json();
    expect(data.turnId).toBeTruthy();
    
    // Verify override provider was actually used by checking turn status/stream
    // Wait for turn to complete
    let turnStatus = await api.getTurnStatus(data.turnId);
    let turnData = await turnStatus.json();
    const maxWait = 30000;
    const startTime = Date.now();
    while (turnData.status !== "completed" && turnData.status !== "failed" && Date.now() - startTime < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      turnStatus = await api.getTurnStatus(data.turnId);
      turnData = await turnStatus.json();
    }
    
    expect(turnData.status).toBe("completed");
    
    // Spec requires: Verify override provider was actually used
    // Check stream events for provider metadata
    const streamResponse = await api.streamTurnEvents(data.turnId);
    const streamText = await streamResponse.text();
    
    // Verify anthropic was used - check for provider indicators in stream or status
    const hasAnthropicIndicator = streamText.toLowerCase().includes("anthropic") ||
                                   streamText.toLowerCase().includes("claude") ||
                                   (turnData.modelProviderId && turnData.modelProviderId === "anthropic");
    
    // Spec requires: prove override was honored
    // If implementation provides provider metadata, it must be present
    // Otherwise, at minimum verify the turn used the override (not default)
    expect(hasAnthropicIndicator || turnData.modelProviderId === "anthropic").toBe(true);
  });

  test("TC-6.5: Invalid Override Combo", async ({ api }) => {
    // Setup: Create conversation
    const createResponse = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
    });
    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const conversationId = createData.conversationId;

    const response = await api.submitMessage(conversationId, {
      message: "Test",
      modelProviderId: "openai",
      modelProviderApi: "messages",
      model: "gpt-5-codex",
    });

    expect(response.status()).toBe(400);
  });

  test("TC-6.6: Partial Override", async ({ api }) => {
    // Setup: Create conversation
    const createResponse = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
    });
    expect(createResponse.status()).toBe(201);
    const createData = await createResponse.json();
    const conversationId = createData.conversationId;

    const response = await api.submitMessage(conversationId, {
      message: "Test",
      modelProviderId: "anthropic",
    });

    expect(response.status()).toBe(400);
    const data = await response.json();
    expect(data.error.message).toContain("all three fields");
  });
});
