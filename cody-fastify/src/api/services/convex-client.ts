import { ConvexHttpClient } from "convex/browser";

const CONVEX_URL = process.env.CONVEX_URL;

if (!CONVEX_URL) {
  console.warn("CONVEX_URL is not defined in environment variables. Ensure .env.local is loaded.");
}

export const convexClient = new ConvexHttpClient(CONVEX_URL!);
