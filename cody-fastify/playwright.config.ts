import { defineConfig } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { mkdirSync, rmSync } from "node:fs";
import dotenv from "dotenv";

// Load environment variables from .env.local
dotenv.config({ path: ".env.local" });

const workspaceRoot = fileURLToPath(new URL("..", import.meta.url));
const defaultCodyHome =
  process.env.CODY_HOME ?? join(workspaceRoot, "tmp-cody-home");
const reuseExistingServer =
  process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === "true";

// Ensure a clean Codex state before the server spins up
rmSync(defaultCodyHome, { recursive: true, force: true });
mkdirSync(defaultCodyHome, { recursive: true });
process.env.CODY_HOME = defaultCodyHome;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: "**/*.spec.ts",
  fullyParallel: false, // Disabled to avoid rate limits with live LLM calls
  workers: 1, // Run tests serially to prevent API rate limit issues
  timeout: 120_000,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4010",
    trace: "on-first-retry",
  },
  webServer: {
    command: "bun src/server.ts",
    // Pass through all environment variables (including from .env file) plus CODY_HOME
    env: {
      ...process.env,
      CODY_HOME: defaultCodyHome,
    },
    url: "http://127.0.0.1:4010/health",
    reuseExistingServer,
    timeout: 120_000,
    stdout: "ignore", // Prevent stdout from keeping pipes open
    stderr: "pipe", // Keep stderr for debugging but pipe it properly
  },
  reporter: [["list"], ["html", { outputFolder: "playwright-report" }]],
});
