import { describe, it, expect } from "vitest";
import { formatEnvDisplay } from "./format-env-display.js";

describe("formatEnvDisplay", () => {
  it("returns dash when empty", () => {
    expect(formatEnvDisplay(null, [])).toBe("-");
    expect(formatEnvDisplay(undefined, [])).toBe("-");

    const emptyMap = new Map<string, string>();
    expect(formatEnvDisplay(emptyMap, [])).toBe("-");
  });

  it("formats sorted env pairs", () => {
    const env = new Map<string, string>();
    env.set("B", "two");
    env.set("A", "one");

    expect(formatEnvDisplay(env, [])).toBe("A=*****, B=*****");
  });

  it("formats env vars with asterisks", () => {
    const vars = ["TOKEN", "PATH"];

    expect(formatEnvDisplay(null, vars)).toBe("TOKEN=*****, PATH=*****");
  });

  it("combines env pairs and vars", () => {
    const env = new Map<string, string>();
    env.set("HOME", "/tmp");
    const vars = ["TOKEN"];

    expect(formatEnvDisplay(env, vars)).toBe("HOME=*****, TOKEN=*****");
  });

  it("sorts env map but preserves vars order", () => {
    const env = new Map<string, string>();
    env.set("Z_VAR", "value");
    env.set("A_VAR", "value");
    const vars = ["M_VAR", "B_VAR"];

    // Env map is sorted, but vars are appended in order
    expect(formatEnvDisplay(env, vars)).toBe(
      "A_VAR=*****, Z_VAR=*****, M_VAR=*****, B_VAR=*****",
    );
  });
});
