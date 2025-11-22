import { existsSync } from "node:fs";
import { resolve } from "node:path";

import { config } from "dotenv";

const ENV_FILES = [".env.test.local", ".env.local", ".env"];

for (const file of ENV_FILES) {
  const fullPath = resolve(process.cwd(), file);
  if (existsSync(fullPath)) {
    config({ path: fullPath });
  }
}
