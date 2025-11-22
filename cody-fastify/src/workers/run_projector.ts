/* eslint-disable no-console */
import { initObservability } from "../core/observability.js";
import { PersistenceWorker } from "./persistence-worker.js";

async function main() {
  initObservability({ serviceName: "core2-projector" });

  const worker = new PersistenceWorker({
    redisUrl: process.env.REDIS_URL,
    convexUrl: process.env.CONVEX_URL,
  });

  await worker.start();
  console.log("[projector] worker started");

  await new Promise<void>((resolve) => {
    let stopping = false;
    const shutdown = async (signal: NodeJS.Signals) => {
      if (stopping) return;
      stopping = true;
      console.log(`[projector] received ${signal}, stopping...`);
      await worker.stop();
      resolve();
    };

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);
  });

  console.log("[projector] worker stopped");
}

void main().catch((error) => {
  console.error("[projector] fatal error", error);
  process.exit(1);
});
