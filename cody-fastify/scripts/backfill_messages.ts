#!/usr/bin/env bun

import "dotenv/config";

import { ConvexHttpClient } from "convex/browser";

import { api } from "../convex/_generated/api.js";
import type { Id } from "../convex/_generated/dataModel.js";

async function main(): Promise<void> {
  const convexUrl = process.env.CONVEX_URL;
  if (!convexUrl) {
    console.error("CONVEX_URL is required");
    process.exit(1);
  }

  const client = new ConvexHttpClient(convexUrl);
  const ids = await client.query(api.messages.listMessageIds, {});
  console.log(`Found ${ids.length} message documents to backfill.`);

  let succeeded = 0;
  for (const id of ids as Id<"messages">[]) {
    try {
      const result = await client.mutation(api.messages.backfillMessage, {
        id,
      });
      if (result?.status === "updated") {
        succeeded += 1;
        if (succeeded % 50 === 0) {
          console.log(`Backfilled ${succeeded} / ${ids.length} documents...`);
        }
      }
    } catch (error) {
      console.error(`Failed to backfill message ${id}`, error);
    }
  }

  console.log(`Backfill complete. Updated ${succeeded} documents.`);
}

await main();

