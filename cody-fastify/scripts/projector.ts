/* eslint-disable no-console */
import { randomUUID } from "node:crypto";
import { RedisStream } from "../src/core/redis.js";
import { ResponseReducer } from "../src/core/reducer.js";
import { streamKeyForRun } from "../src/core/schema.js";

async function main() {
  const runId = process.env.RUN_ID ?? randomUUID();
  const redisUrl = process.env.REDIS_URL;

  const redis = await RedisStream.connect({ url: redisUrl });
  const reducer = new ResponseReducer();
  const streamKey = streamKeyForRun(runId);

  console.log(`projector: listening on ${streamKey}`);

  let cursor = "0-0";
  let done = false;
  let idleCount = 0;
  while (!done) {
    const records = await redis.read(streamKey, cursor, 5000, 100);
    if (!records.length) {
      idleCount += 1;
      if (idleCount >= 3) {
        console.log("projector: no new events, exiting");
        break;
      }
      continue;
    }
    idleCount = 0;

    for (const rec of records) {
      cursor = rec.id;
      const snapshot = reducer.apply(rec.event);
      if (snapshot) {
        console.log(JSON.stringify(snapshot, null, 2));
      }
      if (rec.event.payload.type === "response_done") {
        done = true;
        break;
      }
    }
  }

  await redis.close();
}

void main().catch((err) => {
  console.error("[projector] failed", err);
  process.exit(1);
});
