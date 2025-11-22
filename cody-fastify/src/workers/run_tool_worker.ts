/* eslint-disable no-console */
import { initObservability } from "../core/observability.js";
import { ToolWorker } from "./tool-worker.js";

async function main() {
  initObservability({ serviceName: "core2-tool-worker" });

  const worker = new ToolWorker({
    redisUrl: process.env.REDIS_URL,
  });

  await worker.start();
  console.log("[tool-worker] worker started");

  await new Promise<void>((resolve) => {
    let stopping = false;
    const shutdown = async (signal: NodeJS.Signals) => {
      if (stopping) return;
      stopping = true;
      console.log(`[tool-worker] received ${signal}, stopping...`);
      await worker.stop();
      resolve();
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });

  console.log("[tool-worker] worker stopped");
}

void main().catch((error) => {
  console.error("[tool-worker] fatal error", error);
  process.exit(1);
});
