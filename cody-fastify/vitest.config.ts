import { defineConfig } from "vitest/config";
import { config } from "dotenv";

config({ path: ".env.local" });

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    testTimeout: 10_000, // Reduced from 30_000 to 10_000 as per prompt
    hookTimeout: 60_000,
    env: {
      CONVEX_URL: process.env.CONVEX_URL || "",
      REDIS_URL: process.env.REDIS_URL || "redis://localhost:6379",
    },
  },
});
