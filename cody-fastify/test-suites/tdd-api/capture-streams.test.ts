import { describe, test, expect, beforeAll } from "bun:test";
import { validateEnvironment } from "./validate-env";
import { StreamEvent } from "../../src/core/schema";
import { RedisStream } from "../../src/core/redis";
import { streamKeyForRun } from "../../src/core/schema";
import { writeFile } from "node:fs/promises";

const BASE_URL = "http://localhost:4010";

describe("capture-streams: tool calls", () => {
  let redis: RedisStream;

  beforeAll(async () => {
    await validateEnvironment();
    redis = await RedisStream.connect();
  });

  test("capture OpenAI tool call stream", async () => {
    // Submit prompt
    const submitRes = await fetch(`${BASE_URL}/api/v2/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "Run pwd and ls commands",
        providerId: "openai",
        model: "gpt-5.1-codex-mini",
      }),
    });

    if (!submitRes.ok) {
      const errorText = await submitRes.text();
      throw new Error(`Submit failed: ${submitRes.status} ${errorText}`);
    }
    expect(submitRes.status).toBe(202);
    const submitBody = (await submitRes.json()) as { runId: string };
    const runId = submitBody.runId;

    // Capture all events from Redis stream
    const streamKey = streamKeyForRun(runId);
    const allEvents: Array<{ id: string; event: StreamEvent }> = [];
    let cursor = "0-0";
    const startTime = Date.now();
    const timeout = 20000; // 20 seconds

    while (Date.now() - startTime < timeout) {
      const records = await redis.read(streamKey, cursor, 1000, 100);
      if (records.length === 0) {
        // Check if we got response_done
        const lastEvent = allEvents[allEvents.length - 1]?.event;
        if (lastEvent?.payload?.type === "response_done") {
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }

      for (const record of records) {
        allEvents.push({ id: record.id, event: record.event });
        cursor = record.id;
      }

      // Check if we got response_done
      const lastEvent = allEvents[allEvents.length - 1]?.event;
      if (lastEvent?.payload?.type === "response_done") {
        break;
      }
    }

    // Save to file
    const output = {
      provider: "openai",
      runId,
      streamKey,
      totalEvents: allEvents.length,
      events: allEvents.map((r) => r.event),
    };

    await writeFile(
      "/tmp/openai-tool-calls-stream.json",
      JSON.stringify(output, null, 2),
    );

    console.log(`[OPENAI] Captured ${allEvents.length} events, saved to /tmp/openai-tool-calls-stream.json`);
  });

  test("capture Anthropic tool call stream", async () => {
    // Submit prompt
    const submitRes = await fetch(`${BASE_URL}/api/v2/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: "Run pwd and ls commands",
        providerId: "anthropic",
        model: "claude-haiku-4-5",
      }),
    });

    if (!submitRes.ok) {
      const errorText = await submitRes.text();
      throw new Error(`Submit failed: ${submitRes.status} ${errorText}`);
    }
    expect(submitRes.status).toBe(202);
    const submitBody = (await submitRes.json()) as { runId: string };
    const runId = submitBody.runId;

    // Capture all events from Redis stream
    const streamKey = streamKeyForRun(runId);
    const allEvents: Array<{ id: string; event: StreamEvent }> = [];
    let cursor = "0-0";
    const startTime = Date.now();
    const timeout = 20000; // 20 seconds

    while (Date.now() - startTime < timeout) {
      const records = await redis.read(streamKey, cursor, 1000, 100);
      if (records.length === 0) {
        // Check if we got response_done
        const lastEvent = allEvents[allEvents.length - 1]?.event;
        if (lastEvent?.payload?.type === "response_done") {
          break;
        }
        // If we've been waiting a while and have some events, save what we have
        if (allEvents.length > 0 && Date.now() - startTime > timeout - 2000) {
          console.log(`[ANTHROPIC] Timeout approaching, saving ${allEvents.length} events captured so far`);
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
        continue;
      }

      for (const record of records) {
        allEvents.push({ id: record.id, event: record.event });
        cursor = record.id;
      }

      // Check if we got response_done
      const lastEvent = allEvents[allEvents.length - 1]?.event;
      if (lastEvent?.payload?.type === "response_done") {
        break;
      }
    }

    // Save to file
    const output = {
      provider: "anthropic",
      runId,
      streamKey,
      totalEvents: allEvents.length,
      events: allEvents.map((r) => r.event),
    };

    await writeFile(
      "/tmp/anthropic-tool-calls-stream.json",
      JSON.stringify(output, null, 2),
    );

    console.log(`[ANTHROPIC] Captured ${allEvents.length} events, saved to /tmp/anthropic-tool-calls-stream.json`);
    
    // Also log summary of event types
    const eventTypes = new Map<string, number>();
    for (const e of allEvents) {
      const type = e.event.payload?.type ?? "unknown";
      eventTypes.set(type, (eventTypes.get(type) ?? 0) + 1);
    }
    console.log(`[ANTHROPIC] Event type counts:`, Object.fromEntries(eventTypes));
  });
});

