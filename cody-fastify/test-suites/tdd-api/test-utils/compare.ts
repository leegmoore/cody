import { expect } from "bun:test";
import type { OutputItem, Response } from "../../../src/core/schema";
import type { RunData, OutputItemData, UsageData } from "./types";

/**
 * Compare hydrated response to persisted run
 */
export function compareResponseToRun(
  hydratedResponse: Response,
  persistedRun: RunData,
): void {
  expect(hydratedResponse.id).toBe(persistedRun.id);
  expect(hydratedResponse.turn_id).toBe(persistedRun.turn_id);
  expect(hydratedResponse.thread_id).toBe(persistedRun.thread_id);
  expect(hydratedResponse.model_id).toBe(persistedRun.model_id);
  expect(hydratedResponse.provider_id).toBe(persistedRun.provider_id);
  expect(hydratedResponse.status).toBe(persistedRun.status);
  expect(hydratedResponse.finish_reason).toBe(persistedRun.finish_reason);
  expect(hydratedResponse.output_items.length).toBe(
    persistedRun.output_items.length,
  );
}

/**
 * Compare output items (hydrated vs persisted)
 */
export function compareOutputItems(
  hydratedItems: readonly OutputItem[],
  persistedItems: OutputItemData[],
): void {
  for (let i = 0; i < hydratedItems.length; i++) {
    const hydratedItem = hydratedItems[i];
    const persistedItem = persistedItems[i];

    // Common fields
    expect(hydratedItem.id).toBe(persistedItem.id);
    expect(hydratedItem.type).toBe(persistedItem.type);

    // Type-specific fields
    if (hydratedItem.type === "message" && persistedItem.type === "message") {
      const hydratedContent =
        "content" in hydratedItem ? hydratedItem.content : undefined;
      const hydratedOrigin =
        "origin" in hydratedItem ? hydratedItem.origin : undefined;
      expect(hydratedContent).toBe(persistedItem.content);
      expect(hydratedOrigin).toBe(
        persistedItem.origin as typeof hydratedOrigin,
      );
    }

    if (
      hydratedItem.type === "function_call" &&
      persistedItem.type === "function_call"
    ) {
      const hydratedName =
        "name" in hydratedItem ? hydratedItem.name : undefined;
      const hydratedCallId =
        "call_id" in hydratedItem ? hydratedItem.call_id : undefined;
      const hydratedArguments =
        "arguments" in hydratedItem ? hydratedItem.arguments : undefined;
      const hydratedOrigin =
        "origin" in hydratedItem ? hydratedItem.origin : undefined;
      expect(hydratedName).toBe(persistedItem.name);
      expect(hydratedCallId).toBe(persistedItem.call_id);
      expect(hydratedArguments).toBe(persistedItem.arguments);
      expect(hydratedOrigin).toBe(
        persistedItem.origin as typeof hydratedOrigin,
      );
    }

    if (
      hydratedItem.type === "function_call_output" &&
      persistedItem.type === "function_call_output"
    ) {
      const hydratedCallId =
        "call_id" in hydratedItem ? hydratedItem.call_id : undefined;
      const hydratedOutput =
        "output" in hydratedItem ? hydratedItem.output : undefined;
      const hydratedSuccess =
        "success" in hydratedItem ? hydratedItem.success : undefined;
      const hydratedOrigin =
        "origin" in hydratedItem ? hydratedItem.origin : undefined;
      expect(hydratedCallId).toBe(persistedItem.call_id);
      expect(hydratedOutput).toBe(persistedItem.output);
      expect(hydratedSuccess).toBe(persistedItem.success);
      expect(hydratedOrigin).toBe(
        persistedItem.origin as typeof hydratedOrigin,
      );
    }

    if (
      hydratedItem.type === "reasoning" &&
      persistedItem.type === "reasoning"
    ) {
      const hydratedContent =
        "content" in hydratedItem ? hydratedItem.content : undefined;
      const hydratedOrigin =
        "origin" in hydratedItem ? hydratedItem.origin : undefined;
      expect(hydratedContent).toBe(persistedItem.content);
      expect(hydratedOrigin).toBe(
        persistedItem.origin as typeof hydratedOrigin,
      );
    }
  }
}

/**
 * Compare usage (with optional handling for missing data)
 */
export function compareUsage(
  hydratedUsage:
    | { prompt_tokens: number; completion_tokens: number; total_tokens: number }
    | undefined,
  persistedUsage: UsageData | undefined,
  required: boolean = true,
): void {
  if (required) {
    expect(hydratedUsage).toBeDefined();
    expect(persistedUsage).toBeDefined();
  }

  if (hydratedUsage && persistedUsage) {
    expect(hydratedUsage.prompt_tokens).toBe(persistedUsage.prompt_tokens);
    expect(hydratedUsage.completion_tokens).toBe(
      persistedUsage.completion_tokens,
    );
    expect(hydratedUsage.total_tokens).toBe(persistedUsage.total_tokens);
  }
}
