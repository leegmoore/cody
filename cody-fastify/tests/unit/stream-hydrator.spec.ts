import { describe, expect, it } from "vitest";

import { StreamHydrator } from "../../src/client/hydration.js";
import { HydrationError } from "../../src/client/errors.js";
import type { StreamEvent } from "../../src/core/schema.js";

const RUN_ID = "123e4567-e89b-12d3-a456-426614174000";
const TURN_ID = "223e4567-e89b-22d3-a456-426614174001";
const THREAD_ID = "323e4567-e89b-32d3-a456-426614174002";
const ITEM_ID = "423e4567-e89b-42d3-a456-426614174003";

const BASE_TRACE = {
  traceparent: "00-0123456789abcdef0123456789abcdef-0123456789abcdef-01",
};

function buildHappyPathEvents(): StreamEvent[] {
  const events: StreamEvent[] = [
    {
      event_id: "aaaa1111-0000-4000-8000-000000000001",
      timestamp: 1,
      trace_context: BASE_TRACE,
      run_id: RUN_ID,
      type: "response_start",
      payload: {
        type: "response_start",
        response_id: RUN_ID,
        turn_id: TURN_ID,
        thread_id: THREAD_ID,
        agent_id: undefined,
        model_id: "gpt-5-mini",
        provider_id: "openai",
        created_at: 1,
      },
    },
    {
      event_id: "aaaa1111-0000-4000-8000-000000000002",
      timestamp: 2,
      trace_context: BASE_TRACE,
      run_id: RUN_ID,
      type: "item_start",
      payload: {
        type: "item_start",
        item_id: ITEM_ID,
        item_type: "message",
        initial_content: undefined,
        name: undefined,
        arguments: undefined,
        code: undefined,
      },
    },
    {
      event_id: "aaaa1111-0000-4000-8000-000000000003",
      timestamp: 3,
      trace_context: BASE_TRACE,
      run_id: RUN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: ITEM_ID,
        delta_content: "Hello",
      },
    },
    {
      event_id: "aaaa1111-0000-4000-8000-000000000004",
      timestamp: 4,
      trace_context: BASE_TRACE,
      run_id: RUN_ID,
      type: "item_delta",
      payload: {
        type: "item_delta",
        item_id: ITEM_ID,
        delta_content: " world",
      },
    },
    {
      event_id: "aaaa1111-0000-4000-8000-000000000005",
      timestamp: 5,
      trace_context: BASE_TRACE,
      run_id: RUN_ID,
      type: "item_done",
      payload: {
        type: "item_done",
        item_id: ITEM_ID,
        final_item: {
          id: ITEM_ID,
          type: "message",
          content: "Hello world",
          origin: "agent",
          correlation_id: undefined,
        },
      },
    },
    {
      event_id: "aaaa1111-0000-4000-8000-000000000006",
      timestamp: 6,
      trace_context: BASE_TRACE,
      run_id: RUN_ID,
      type: "response_done",
      payload: {
        type: "response_done",
        response_id: RUN_ID,
        status: "complete",
        usage: {
          prompt_tokens: 10,
          completion_tokens: 3,
          total_tokens: 13,
        },
        finish_reason: null,
      },
    },
  ];

  return events;
}

describe("StreamHydrator", () => {
  it("hydrates a response from canonical events", () => {
    const hydrator = new StreamHydrator();
    const { response, events } = hydrator.hydrateFromEvents(
      buildHappyPathEvents(),
    );

    expect(events).toHaveLength(6);
    expect(response.id).toBe(RUN_ID);
    expect(response.status).toBe("complete");
    expect(response.output_items).toHaveLength(1);
    expect(response.output_items[0]).toMatchObject({
      id: ITEM_ID,
      type: "message",
      content: "Hello world",
      origin: "agent",
    });
    expect(response.usage).toEqual({
      prompt_tokens: 10,
      completion_tokens: 3,
      total_tokens: 13,
    });
  });

  it("throws when response_start is missing", () => {
    const hydrator = new StreamHydrator();
    const events = buildHappyPathEvents().filter(
      (event) => event.payload.type !== "response_start",
    );

    expect(() => hydrator.hydrateFromEvents(events)).toThrow(HydrationError);
  });
});
