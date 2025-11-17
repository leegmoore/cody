import { test, expect, ApiClient } from "./fixtures/api-client";

// Helper function to wait for turn completion by polling
async function waitForTurnCompletion(
  api: ApiClient,
  turnId: string,
  maxWaitMs = 30000,
  pollIntervalMs = 100,
) {
  const startTime = Date.now();
  while (Date.now() - startTime < maxWaitMs) {
    const response = await api.getTurnStatus(turnId);
    if (response.status() !== 200) {
      throw new Error(`Turn status check failed: ${response.status()}`);
    }
    const data = await response.json();
    if (data.status === "completed" || data.status === "failed") {
      return data;
    }
    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
  throw new Error(`Turn ${turnId} did not complete within ${maxWaitMs}ms`);
}

// Helper function to wait for turn completion via stream
async function waitForStreamCompletion(
  api: ApiClient,
  turnId: string,
  query?: { thinkingLevel?: string; toolLevel?: string },
) {
  const response = await api.streamTurnEvents(turnId, query);
  if (response.status() !== 200) {
    throw new Error(`Stream request failed: ${response.status()}`);
  }
  const text = await response.text();
  // Verify we got task_complete event
  const events = parseSSE(text);
  const hasTaskComplete = events.some(
    (e) => e.event === "task_complete" || e.data?.includes('"event":"task_complete"'),
  );
  if (!hasTaskComplete) {
    throw new Error("Stream did not contain task_complete event");
  }
  return events;
}

// Helper function to parse SSE stream
function parseSSE(text: string): Array<{ event?: string; data?: string; id?: string }> {
  const events: Array<{ event?: string; data?: string; id?: string }> = [];
  const lines = text.split("\n");
  let currentEvent: { event?: string; data?: string; id?: string } = {};

  for (const line of lines) {
    if (line.startsWith("event:")) {
      currentEvent.event = line.substring(6).trim();
    } else if (line.startsWith("data:")) {
      currentEvent.data = line.substring(5).trim();
    } else if (line.startsWith("id:")) {
      currentEvent.id = line.substring(3).trim();
    } else if (line === "") {
      // Empty line indicates end of event
      if (currentEvent.event || currentEvent.data) {
        events.push(currentEvent);
        currentEvent = {};
      }
    }
  }
  // Push last event if exists
  if (currentEvent.event || currentEvent.data) {
    events.push(currentEvent);
  }
  return events;
}

test.describe("Turns - Status (TC-7)", () => {
  test("TC-7.1: Completed Turn with Defaults", async ({ api }) => {
    // Setup: Create conversation, submit message, wait for completion
    const createResp = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
    });
    expect(createResp.status()).toBe(201);
    const { conversationId } = await createResp.json();

    const submitResp = await api.submitMessage(conversationId, {
      message: "Test",
    });
    expect(submitResp.status()).toBe(202);
    const { turnId } = await submitResp.json();

    // Wait for completion
    const turnData = await waitForTurnCompletion(api, turnId);

    // Verify all fields per spec
    expect(turnData.status).toBe("completed");
    expect(turnData.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(turnData.completedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(turnData.result).toBeTruthy(); // Must have result
    // Spec requires: thinking = [] (empty array for defaults)
    expect(Array.isArray(turnData.thinking)).toBe(true);
    expect(turnData.thinking).toEqual([]);
    // Spec requires: toolCalls = [] (empty array, toolLevel defaults to none)
    expect(Array.isArray(turnData.toolCalls)).toBe(true);
    expect(turnData.toolCalls).toEqual([]);
  });

  test("TC-7.2: With thinkingLevel=none", async ({ api }) => {
    // Setup: Create conversation, submit message, wait for completion
    const createResp = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
    });
    expect(createResp.status()).toBe(201);
    const { conversationId } = await createResp.json();

    const submitResp = await api.submitMessage(conversationId, {
      message: "Test",
    });
    expect(submitResp.status()).toBe(202);
    const { turnId } = await submitResp.json();

    // Wait for completion
    await waitForTurnCompletion(api, turnId);

    // Get status with thinkingLevel=none
    const response = await api.getTurnStatus(turnId, {
      thinkingLevel: "none",
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.status).toBe("completed");
    // Verify thinking field is absent or empty array
    expect(
      data.thinking === undefined || Array.isArray(data.thinking),
    ).toBe(true);
  });

  test("TC-7.3: With toolLevel=full", async ({ api }) => {
    // Setup: Create conversation, submit message that uses tool, wait for completion
    const createResp = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
    });
    expect(createResp.status()).toBe(201);
    const { conversationId } = await createResp.json();

    const submitResp = await api.submitMessage(conversationId, {
      message: "Read the file test.txt",
    });
    expect(submitResp.status()).toBe(202);
    const { turnId } = await submitResp.json();

    // Wait for completion
    await waitForTurnCompletion(api, turnId);

    // Get status with toolLevel=full
    const response = await api.getTurnStatus(turnId, {
      toolLevel: "full",
    });

    expect(response.status()).toBe(200);
    const data = await response.json();
    expect(data.status).toBe("completed");
    // Spec requires: tool-driven turn must expose non-empty toolCalls
    // For "read file" scenario, tool should be used
    expect(Array.isArray(data.toolCalls)).toBe(true);
    expect(data.toolCalls.length).toBeGreaterThan(0); // Must have at least one toolCall
    
    // Verify each toolCall has required fields
    for (const toolCall of data.toolCalls) {
      expect(toolCall.name).toBeTruthy();
      expect(toolCall.callId).toBeTruthy();
      expect(toolCall.input).toBeTruthy();
      expect(toolCall.output).toBeTruthy();
    }
  });

  test("TC-7.4: Running Turn", async ({ api }) => {
    // Setup: Create conversation, submit message (mock slow response)
    // Spec requires: setup calls for "mock slow response" so we must observe running status
    const createResp = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
    });
    expect(createResp.status()).toBe(201);
    const { conversationId } = await createResp.json();

    const submitResp = await api.submitMessage(conversationId, {
      message: "Test",
    });
    expect(submitResp.status()).toBe(202);
    const { turnId } = await submitResp.json();

    // Immediately check status (should be running for slow response)
    // Try multiple times quickly to catch running state
    let runningStateObserved = false;
    let runningStateData: any = null;
    
    for (let i = 0; i < 10; i++) {
      const response = await api.getTurnStatus(turnId);
      expect(response.status()).toBe(200);
      const data = await response.json();
      
      expect(data.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
      
      if (data.status === "running") {
        runningStateObserved = true;
        runningStateData = data;
        // Spec requires: running turn shows completedAt null, no result
        expect(data.completedAt).toBeNull();
        expect(data.result).toBeFalsy(); // Result absent or null for running turn
        break;
      }
      
      await new Promise((resolve) => setTimeout(resolve, 5)); // Very short delay
    }
    
    // Spec requires: mock slow response must show running status
    // The spec setup calls for "mock slow response" so running state MUST be observable
    // This is a mandatory requirement - the test must verify running state was observed
    expect(runningStateObserved).toBe(true);
    expect(runningStateData).not.toBeNull();
    expect(runningStateData.status).toBe("running");
    expect(runningStateData.completedAt).toBeNull();
    expect(runningStateData.result).toBeFalsy();
  });

  test("TC-7.5: Turn Not Found", async ({ api }) => {
    const response = await api.getTurnStatus("nonexistent-turn-id");

    expect(response.status()).toBe(404);
  });
});

test.describe("Turns - Stream Events (TC-8)", () => {
  test("TC-8.1: Basic Stream", async ({ api }) => {
    // Setup: Create conversation, submit simple message
    const createResp = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
    });
    expect(createResp.status()).toBe(201);
    const { conversationId } = await createResp.json();

    const submitResp = await api.submitMessage(conversationId, {
      message: "Hello",
    });
    expect(submitResp.status()).toBe(202);
    const { turnId } = await submitResp.json();

    const response = await api.streamTurnEvents(turnId);

    expect(response.status()).toBe(200);
    expect(response.headers()["content-type"]).toContain("text/event-stream");

    // Parse SSE stream and verify event sequence
    const text = await response.text();
    const events = parseSSE(text);

    // Spec requires: strict sequence task_started → agent_message → task_complete
    const eventTypes: string[] = [];
    for (const e of events) {
      let eventType: string | null = null;
      if (e.event) {
        eventType = e.event;
      } else if (e.data) {
        try {
          const parsed = JSON.parse(e.data);
          eventType = parsed.event || parsed.type;
        } catch {
          // Check data content for event indicators
          if (e.data.includes('"event":"task_started"') || e.data.includes("task_started")) {
            eventType = "task_started";
          } else if (e.data.includes('"event":"agent_message"') || e.data.includes("agent_message")) {
            eventType = "agent_message";
          } else if (e.data.includes('"event":"task_complete"') || e.data.includes("task_complete")) {
            eventType = "task_complete";
          }
        }
      }
      if (eventType) {
        eventTypes.push(eventType);
      }
    }

    // Verify strict ordering: task_started must come before agent_message, which must come before task_complete
    const startedIdx = eventTypes.indexOf("task_started");
    const messageIdx = eventTypes.indexOf("agent_message");
    const completeIdx = eventTypes.indexOf("task_complete");
    
    expect(startedIdx).not.toBe(-1);
    expect(messageIdx).not.toBe(-1);
    expect(completeIdx).not.toBe(-1);
    expect(startedIdx).toBeLessThan(messageIdx);
    expect(messageIdx).toBeLessThan(completeIdx);
  });

  test("TC-8.2: Stream with Tool Execution", async ({ api }) => {
    // Setup: Create conversation, submit message requiring tool
    const createResp = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
    });
    expect(createResp.status()).toBe(201);
    const { conversationId } = await createResp.json();

    const submitResp = await api.submitMessage(conversationId, {
      message: "Read the file test.txt",
    });
    expect(submitResp.status()).toBe(202);
    const { turnId } = await submitResp.json();

    const response = await api.streamTurnEvents(turnId, {
      toolLevel: "full",
    });

    expect(response.status()).toBe(200);
    const text = await response.text();
    const events = parseSSE(text);

    // Verify event sequence includes tool execution events
    const eventTypes = events
      .map((e) => {
        if (e.event) return e.event;
        if (e.data) {
          try {
            const parsed = JSON.parse(e.data);
            return parsed.event || parsed.type;
          } catch {
            if (e.data.includes("exec_command_begin")) return "exec_command_begin";
            if (e.data.includes("exec_command_end")) return "exec_command_end";
            if (e.data.includes("task_started")) return "task_started";
            if (e.data.includes("agent_message")) return "agent_message";
            if (e.data.includes("task_complete")) return "task_complete";
          }
        }
        return null;
      })
      .filter((e): e is string => e !== null);

    // Spec requires: task_started, exec_command_begin, exec_command_end, agent_message, task_complete
    const startedIdx = eventTypes.indexOf("task_started");
    const beginIdx = eventTypes.indexOf("exec_command_begin");
    const endIdx = eventTypes.indexOf("exec_command_end");
    const messageIdx = eventTypes.indexOf("agent_message");
    const completeIdx = eventTypes.indexOf("task_complete");
    
    expect(startedIdx).not.toBe(-1);
    expect(completeIdx).not.toBe(-1);
    
    // Spec requires: tool scenario MUST include exec_command_begin and exec_command_end
    // For "read file" scenario, tool events are required
    expect(beginIdx).not.toBe(-1); // exec_command_begin must be present
    expect(endIdx).not.toBe(-1); // exec_command_end must be present
    expect(messageIdx).not.toBe(-1); // agent_message must be present
    
    // Verify strict ordering
    expect(startedIdx).toBeLessThan(beginIdx);
    expect(beginIdx).toBeLessThan(endIdx);
    expect(endIdx).toBeLessThan(messageIdx);
    expect(messageIdx).toBeLessThan(completeIdx);
  });

  test("TC-8.3: With thinkingLevel=none", async ({ api }) => {
    // Setup: Submit message
    const createResp = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
    });
    expect(createResp.status()).toBe(201);
    const { conversationId } = await createResp.json();

    const submitResp = await api.submitMessage(conversationId, {
      message: "Test",
    });
    expect(submitResp.status()).toBe(202);
    const { turnId } = await submitResp.json();

    const response = await api.streamTurnEvents(turnId, {
      thinkingLevel: "none",
    });

    expect(response.status()).toBe(200);
    const text = await response.text();
    const events = parseSSE(text);

    // Verify no agent_reasoning events
    const hasReasoning = events.some((e) => {
      const dataStr = e.data || "";
      return (
        e.event === "agent_reasoning" ||
        dataStr.includes("agent_reasoning") ||
        dataStr.includes("reasoning")
      );
    });
    expect(hasReasoning).toBe(false);

    // Verify agent_message events present
    const hasAgentMessage = events.some((e) => {
      const dataStr = e.data || "";
      return (
        e.event === "agent_message" ||
        dataStr.includes("agent_message") ||
        dataStr.includes('"event":"agent_message"')
      );
    });
    expect(hasAgentMessage).toBe(true);
  });

  test("TC-8.4: Client Disconnect and Reconnect", async ({ api }) => {
    // Setup: Create conversation, submit message
    const createResp = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
    });
    expect(createResp.status()).toBe(201);
    const { conversationId } = await createResp.json();

    const submitResp = await api.submitMessage(conversationId, {
      message: "Test message",
    });
    expect(submitResp.status()).toBe(202);
    const { turnId } = await submitResp.json();

    // Subscribe to stream and read first 3 events, then disconnect
    const firstResponse = await api.streamTurnEvents(turnId);
    expect(firstResponse.status()).toBe(200);
    
    // Read stream incrementally to simulate early disconnect
    // Note: Playwright's response.text() reads entire stream, so we simulate by
    // reading full stream but only using first 3 events for reconnection
    const firstText = await firstResponse.text();
    const firstEvents = parseSSE(firstText);
    
    // Spec requires: receive first 3 events, save last event ID, disconnect
    expect(firstEvents.length).toBeGreaterThanOrEqual(3);
    const firstThreeEvents = firstEvents.slice(0, 3);
    const lastEventId = firstThreeEvents[firstThreeEvents.length - 1]?.id;
    
    // If no ID in first 3, use the 3rd event's position
    // Reconnect with Last-Event-ID header
    expect(lastEventId).toBeTruthy();
    
    const secondResponse = await api.streamTurnEvents(
      turnId,
      undefined,
      { "Last-Event-ID": lastEventId! },
    );
    expect(secondResponse.status()).toBe(200);
    const secondText = await secondResponse.text();
    const secondEvents = parseSSE(secondText);

    // Verify no duplicates: second stream should start from event 4
    // Collect all event IDs from first 3 events
    const firstThreeIds = firstThreeEvents.map(e => e.id).filter(Boolean);
    
    // Verify second stream doesn't contain the first 3 event IDs
    const secondEventIds = secondEvents.map(e => e.id).filter(Boolean);
    for (const id of firstThreeIds) {
      expect(secondEventIds).not.toContain(id);
    }
    
    // Verify second stream has events (resume from event 4)
    expect(secondEvents.length).toBeGreaterThan(0);
    
    // Verify complete sequence when combined: first 3 + remaining events
    const combinedEvents = [...firstThreeEvents, ...secondEvents];
    const hasComplete = combinedEvents.some(e => 
      (e.data || "").includes("task_complete")
    );
    expect(hasComplete).toBe(true);
  });

  test.skip("TC-8.5: Multiple Subscribers", async ({ api }) => {
    // SKIPPED: Playwright's API doesn't support incremental stream reading
    // and true early disconnect simulation. The spec requires testing that
    // "either client can disconnect without affecting the other", which requires
    // reading partial data from one stream and then canceling it mid-stream,
    // which Playwright's response.text() doesn't support.
    // Setup: Submit message
    const createResp = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
    });
    expect(createResp.status()).toBe(201);
    const { conversationId } = await createResp.json();

    const submitResp = await api.submitMessage(conversationId, {
      message: "Test",
    });
    expect(submitResp.status()).toBe(202);
    const { turnId } = await submitResp.json();

    // Both clients subscribe simultaneously
    const responseA = await api.streamTurnEvents(turnId);
    const responseB = await api.streamTurnEvents(turnId);

    expect(responseA.status()).toBe(200);
    expect(responseB.status()).toBe(200);

    // Spec requires: "either client can disconnect without affecting the other"
    // To test disconnection, we simulate early disconnect of A by using a timeout
    // and verify B continues independently
    
    // Start reading both streams concurrently
    const readAPromise = responseA.text();
    const readBPromise = responseB.text();
    
    // Simulate early disconnect of client A after a short delay
    // Use Promise.race to get partial data from A, then "disconnect" by not awaiting completion
    let textAPartial = "";
    let eventsAPartial: Array<{ event?: string; data?: string; id?: string }> = [];
    
    try {
      // Wait a short time to let some events arrive, then simulate disconnect
      // This simulates client A disconnecting mid-stream
      textAPartial = await Promise.race([
        readAPromise,
        new Promise<string>((resolve) => {
          setTimeout(() => {
            // Simulate disconnect by resolving with empty string
            // In real scenario, client would close connection
            resolve("");
          }, 200); // Short timeout to simulate early disconnect
        }),
      ]);
      
      // If we got partial data, parse it
      if (textAPartial) {
        eventsAPartial = parseSSE(textAPartial);
      }
    } catch {
      // If A already completed or errored, that's fine - we simulated disconnect
      textAPartial = "";
    }
    
    // Client A is now "disconnected" (we don't await its full completion)
    // Client B should continue receiving events independently
    const textB = await readBPromise;
    const eventsB = parseSSE(textB);

    // Spec requires: both clients receive identical events in same order
    // Verify both streams received events
    expect(eventsB.length).toBeGreaterThan(0);
    
    // Verify sequences match for events received by both before A disconnected
    if (eventsAPartial.length > 0) {
      const minLength = Math.min(eventsAPartial.length, eventsB.length);
      expect(minLength).toBeGreaterThan(0);
      for (let i = 0; i < minLength; i++) {
        const eventA = eventsAPartial[i];
        const eventB = eventsB[i];
        // Compare event types or data content
        if (eventA.event && eventB.event) {
          expect(eventA.event).toBe(eventB.event);
        }
        // If events have IDs, they should match
        if (eventA.id && eventB.id) {
          expect(eventA.id).toBe(eventB.id);
        }
      }
    }
    
    // Spec requires: client B completed independently (disconnect of A didn't affect B)
    const hasCompleteB = eventsB.some((e) =>
      (e.data || "").includes("task_complete"),
    );
    expect(hasCompleteB).toBe(true);
    
    // Verify B received complete sequence
    // If A got partial data, B should have more events (proving B continued after A disconnected)
    // If A disconnected immediately, B should still have received all events
    if (eventsAPartial.length > 0) {
      expect(eventsB.length).toBeGreaterThan(eventsAPartial.length);
    } else {
      // Even if A disconnected immediately, B should have received events
      expect(eventsB.length).toBeGreaterThan(0);
    }
  });

  test("TC-8.6: Turn Not Found", async ({ api }) => {
    const response = await api.streamTurnEvents("nonexistent");

    expect(response.status()).toBe(404);
  });

  test("TC-8.7: Keepalive During Long Gaps", async ({ api }) => {
    // Setup: Submit message (mock 20s gap between events)
    // Spec requires: mocked 20s gap must show keepalive comments
    const createResp = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
    });
    expect(createResp.status()).toBe(201);
    const { conversationId } = await createResp.json();

    const submitResp = await api.submitMessage(conversationId, {
      message: "Test",
    });
    expect(submitResp.status()).toBe(202);
    const { turnId } = await submitResp.json();

    const response = await api.streamTurnEvents(turnId);

    expect(response.status()).toBe(200);
    const text = await response.text();

    // Spec requires: keepalive comments (`:keepalive\n\n`) during long gaps
    // Verify keepalive format is present - this is mandatory for mocked 20s gap scenario
    const hasKeepalive = text.includes(":keepalive\n\n") || 
                         text.includes(":keepalive") ||
                         text.match(/^:keepalive$/m);
    
    // Spec requires: mocked 20s gap must show keepalive comments
    // This is a mandatory requirement - keepalive must be present
    expect(hasKeepalive).toBe(true);
    expect(text).toMatch(/:keepalive/);
    
    // Verify connection stays alive: stream completes without timeout
    expect(text.length).toBeGreaterThan(0);
    
    // Verify events arrive correctly after gap (task_complete present)
    const hasComplete = text.includes("task_complete");
    expect(hasComplete).toBe(true);
  });

  test("TC-8.8: Error Event in Stream", async ({ api }) => {
    // Setup: Submit message (mock error during execution)
    // Spec requires: "mock error during execution" - this test MUST exercise error pathway
    const createResp = await api.createConversation({
      modelProviderId: "openai",
      modelProviderApi: "responses",
      model: "gpt-5-codex",
    });
    expect(createResp.status()).toBe(201);
    const { conversationId } = await createResp.json();

    // Submit a message that should trigger an error
    // Note: Actual error depends on implementation, but spec requires error scenario
    const submitResp = await api.submitMessage(conversationId, {
      message: "This should cause an error",
    });
    expect(submitResp.status()).toBe(202);
    const { turnId } = await submitResp.json();

    const response = await api.streamTurnEvents(turnId);

    expect(response.status()).toBe(200);
    const text = await response.text();
    const events = parseSSE(text);

    // Spec requires: task_started → error (with details) → turn_aborted/task_complete (error status)
    const eventTypes: string[] = [];
    for (const e of events) {
      let eventType: string | null = null;
      if (e.event) {
        eventType = e.event;
      } else if (e.data) {
        try {
          const parsed = JSON.parse(e.data);
          eventType = parsed.event || parsed.type;
        } catch {
          if (e.data.includes("task_started")) eventType = "task_started";
          else if (e.data.includes('"event":"error"') || e.data.includes('"type":"error"')) eventType = "error";
          else if (e.data.includes("turn_aborted")) eventType = "turn_aborted";
          else if (e.data.includes("task_complete")) eventType = "task_complete";
        }
      }
      if (eventType) {
        eventTypes.push(eventType);
      }
    }

    const startedIdx = eventTypes.indexOf("task_started");
    expect(startedIdx).not.toBe(-1);

    // Spec requires: error event MUST occur in error scenario
    // Spec explicitly describes error sequence for "mock error during execution"
    // Error event must be present - this is mandatory for error scenario
    const errorIdx = eventTypes.indexOf("error");
    const abortedIdx = eventTypes.indexOf("turn_aborted");
    const completeIdx = eventTypes.indexOf("task_complete");
    
    // Spec requires: error event MUST occur in error scenario
    expect(errorIdx).not.toBe(-1);
    
    // Error event must come after task_started
    expect(startedIdx).toBeLessThan(errorIdx);
    
    // Must have turn_aborted or task_complete after error
    expect(abortedIdx !== -1 || completeIdx !== -1).toBe(true);
    if (abortedIdx !== -1) {
      expect(errorIdx).toBeLessThan(abortedIdx);
    }
    if (completeIdx !== -1 && abortedIdx === -1) {
      expect(errorIdx).toBeLessThan(completeIdx);
    }
    
    // Verify error event has message and details
    const errorEvent = events.find((e, idx) => {
      const eventType = e.event || (e.data && JSON.parse(e.data).event);
      return eventType === "error" || (e.data && e.data.includes('"event":"error"'));
    });
    expect(errorEvent).toBeTruthy();
    if (errorEvent?.data) {
      try {
        const errorData = JSON.parse(errorEvent.data);
        expect(errorData.message || errorData.error?.message).toBeTruthy();
      } catch {
        // Error data may be in different format, but should contain error info
        expect(errorEvent.data).toContain("error");
      }
    }
  });
});
