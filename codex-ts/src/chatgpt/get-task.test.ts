import { describe, test, expect } from "vitest";
import type { GetTaskResponse, OutputItem } from "./get-task";
import { readFileSync } from "fs";
import { join } from "path";

describe("GetTask Types", () => {
  test("deserialize GetTaskResponse from fixture", () => {
    const fixturePath = join(
      __dirname,
      "__fixtures__",
      "task_turn_fixture.json",
    );
    const fixtureContent = readFileSync(fixturePath, "utf-8");
    const response: GetTaskResponse = JSON.parse(fixtureContent);

    expect(response.current_diff_task_turn).toBeDefined();
    expect(response.current_diff_task_turn?.output_items).toHaveLength(2);
  });

  test("parse PR output item with diff", () => {
    const fixturePath = join(
      __dirname,
      "__fixtures__",
      "task_turn_fixture.json",
    );
    const fixtureContent = readFileSync(fixturePath, "utf-8");
    const response: GetTaskResponse = JSON.parse(fixtureContent);

    const outputItems = response.current_diff_task_turn?.output_items ?? [];
    const prItem = outputItems.find(
      (item) => item.type === "pr",
    ) as OutputItem & {
      type: "pr";
    };

    expect(prItem).toBeDefined();
    expect(prItem.output_diff).toBeDefined();
    expect(prItem.output_diff?.diff).toContain("fibonacci.js");
    expect(prItem.output_diff?.diff).toContain("function fibonacci(n)");
  });

  test("parse message output item", () => {
    const fixturePath = join(
      __dirname,
      "__fixtures__",
      "task_turn_fixture.json",
    );
    const fixtureContent = readFileSync(fixturePath, "utf-8");
    const response: GetTaskResponse = JSON.parse(fixtureContent);

    const outputItems = response.current_diff_task_turn?.output_items ?? [];
    const messageItem = outputItems.find((item) => item.type === "message");

    expect(messageItem).toBeDefined();
    expect(messageItem?.type).toBe("message");
  });

  test("extract diff from PR output item", () => {
    const fixturePath = join(
      __dirname,
      "__fixtures__",
      "task_turn_fixture.json",
    );
    const fixtureContent = readFileSync(fixturePath, "utf-8");
    const response: GetTaskResponse = JSON.parse(fixtureContent);

    const outputItems = response.current_diff_task_turn?.output_items ?? [];
    const prItem = outputItems.find(
      (item) => item.type === "pr",
    ) as OutputItem & {
      type: "pr";
    };

    const diff = prItem?.output_diff?.diff;
    expect(diff).toBeDefined();
    expect(diff).toContain("diff --git");
    expect(diff).toContain("new file mode 100644");
    expect(diff).toContain("scripts/fibonacci.js");

    // Verify diff has expected structure
    const lines = diff?.split("\n") ?? [];
    expect(lines.length).toBeGreaterThan(10);
    expect(lines.some((l) => l.startsWith("+#!/usr/bin/env node"))).toBe(true);
  });
});
