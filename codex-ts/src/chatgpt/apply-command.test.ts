import { describe, test, expect } from "vitest";
import { getDiffFromTask } from "./apply-command";
import type { GetTaskResponse } from "./get-task";
import { readFileSync } from "fs";
import { join } from "path";

describe("Apply Command", () => {
  test("extract diff from task response", () => {
    const fixturePath = join(
      __dirname,
      "__fixtures__",
      "task_turn_fixture.json",
    );
    const fixtureContent = readFileSync(fixturePath, "utf-8");
    const response: GetTaskResponse = JSON.parse(fixtureContent);

    const diff = getDiffFromTask(response);

    expect(diff).toBeDefined();
    expect(diff).toContain("diff --git");
    expect(diff).toContain("scripts/fibonacci.js");
    expect(diff).toContain("function fibonacci(n)");
  });

  test("throw error when no diff found", () => {
    const response: GetTaskResponse = {
      current_diff_task_turn: {
        output_items: [],
      },
    };

    expect(() => getDiffFromTask(response)).toThrow(
      "No diff found in task response",
    );
  });

  test("throw error when no diff turn", () => {
    const response: GetTaskResponse = {};

    expect(() => getDiffFromTask(response)).toThrow(
      "No diff found in task response",
    );
  });
});
