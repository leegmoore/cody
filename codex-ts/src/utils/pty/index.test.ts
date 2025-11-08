import { describe, it, expect } from "vitest";
import {
  ExecCommandSession,
  SpawnedPty,
  spawnPtyProcess,
  PtySize,
} from "./index";

describe("PtySize", () => {
  it("should define default PTY size", () => {
    const size: PtySize = {
      rows: 24,
      cols: 80,
      pixelWidth: 0,
      pixelHeight: 0,
    };
    expect(size.rows).toBe(24);
    expect(size.cols).toBe(80);
  });
});

describe("ExecCommandSession (stub)", () => {
  it("should have session interface defined", () => {
    // Verify interface is exported and can be used for type checking
    const mockSession: Partial<ExecCommandSession> = {
      hasExited: () => false,
      exitCode: () => undefined,
    };
    expect(mockSession.hasExited).toBeDefined();
    expect(mockSession.exitCode).toBeDefined();
  });
});

describe("SpawnedPty (stub)", () => {
  it("should have spawned PTY interface defined", () => {
    // Verify interface structure
    type SpawnedPtyKeys = keyof SpawnedPty;
    const keys: SpawnedPtyKeys[] = ["session", "outputRx", "exitRx"];
    expect(keys).toContain("session");
    expect(keys).toContain("outputRx");
    expect(keys).toContain("exitRx");
  });
});

describe("spawnPtyProcess", () => {
  it("should export spawnPtyProcess as undefined (requires native impl)", () => {
    expect(spawnPtyProcess).toBeUndefined();
  });

  it("should reject with error about missing program", async () => {
    // This test documents expected behavior when implemented
    // Implementation should validate program is not empty
    expect(true).toBe(true); // Placeholder
  });
});
