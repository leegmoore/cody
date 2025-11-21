/* eslint-disable no-console */
import { projectRunToConvex } from "../src/core/projector.js";

async function main() {
  const runId = process.env.RUN_ID || process.argv[2];
  if (!runId) {
    throw new Error("RUN_ID is required (env or argv[2])");
  }
  await projectRunToConvex(runId, {
    redisUrl: process.env.REDIS_URL,
    idleMax: 6,
  });
}

void main().catch((err) => {
  console.error("[run_projector] failed", err);
  process.exit(1);
});
