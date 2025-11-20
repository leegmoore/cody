import { test, expect } from "@playwright/test";

const BASE_URL = "http://localhost:4010";
const API_BASE_GLOB = "**/api/v1";

function buildSSE(events: Array<{ event: string; data?: Record<string, unknown> }>) {
  return events
    .map(({ event, data }) => {
      const payload = data ? JSON.stringify(data) : "{}";
      return `event: ${event}\ndata: ${payload}\n\n`;
    })
    .join("");
}

test.describe("Thinking UI", () => {
  test("shows expandable thinking card when streaming reasoning", async ({ page }) => {
    const conversationId = "conv-test-1";
    const turnId = "turn-test-1";
    const thinkingId = "thinking-123";
    let conversationsRequested = 0;
    let conversationDetailRequested = 0;
    let messageRequested = 0;
    let streamRequested = 0;

    await page.route(`${API_BASE_GLOB}/conversations`, async (route) => {
      conversationsRequested++;
      if (route.request().method() === "GET") {
        return route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            conversations: [
              {
                conversationId,
                title: "Demo Conversation",
                summary: "Latest run",
                updatedAt: new Date().toISOString(),
                messageCount: 0,
              },
            ],
          }),
        });
      }

      if (route.request().method() === "POST") {
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ conversationId }),
        });
      }
      return route.continue();
    });

    await page.route(`${API_BASE_GLOB}/conversations/${conversationId}`, async (route) => {
      conversationDetailRequested++;
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ history: [] }),
      });
    });

    await page.route(`${API_BASE_GLOB}/conversations/${conversationId}/messages`, async (route) => {
      messageRequested++;
      return route.fulfill({
        status: 202,
        contentType: "application/json",
        body: JSON.stringify({ turnId }),
      });
    });

    const sseBody = buildSSE([
      { event: "task_started" },
      { event: "thinking_started", data: { thinkingId } },
      { event: "thinking_delta", data: { thinkingId, delta: "Analyzing request. " } },
      { event: "thinking_delta", data: { thinkingId, delta: "Looking up files. " } },
      { event: "thinking_delta", data: { thinkingId, delta: "Ready to respond." } },
      {
        event: "thinking_completed",
        data: { thinkingId, text: "Analyzing request. Looking up files. Ready to respond." },
      },
      { event: "agent_message", data: { message: "Done!" } },
      { event: "task_complete", data: {} },
    ]);

    await page.route(`${API_BASE_GLOB}/turns/${turnId}/stream-events*`, async (route) => {
      streamRequested++;
      return route.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
        body: sseBody,
      });
    });

    await page.goto(BASE_URL);

    await expect
      .poll(() => conversationsRequested, { message: "conversations request" })
      .toBeGreaterThan(0);
    await expect
      .poll(() => conversationDetailRequested, { message: "conversation detail request" })
      .toBeGreaterThan(0);

    await page.fill("#messageInput", "Hello Cody");
    await page.click("#sendButton");

    await expect
      .poll(() => messageRequested, { message: "message submission" })
      .toBeGreaterThan(0);

    await expect
      .poll(() => streamRequested, { message: "stream subscription" })
      .toBeGreaterThan(0);

    const card = page.locator(".thinking-card").first();
    await expect(card).toBeVisible();

    const content = card.locator(".thinking-content");
    await expect(content).toHaveAttribute("data-expanded", "false");
    await expect(content).toHaveText(
      "Analyzing request. Looking up files. Ready to respond.",
    );

    await card.click();
    await expect(content).toHaveAttribute("data-expanded", "true");
  });
});

