import { homedir } from "node:os";
import { join } from "node:path";
import { promises as fs } from "node:fs";

/**
 * Possible locations for Claude OAuth credentials.
 *
 * These mirror common installations of Claude desktop/VS Code integrations.
 * The first path that exists and contains a usable access_token is used.
 */
export const CLAUDE_OAUTH_PATHS = [
  join(homedir(), ".claude", "credentials.json"),
  join(homedir(), ".claude", "config", "auth.json"),
  join(homedir(), ".config", "claude", "credentials.json"),
];

interface ClaudeCredentialFile {
  access_token?: string;
  token?: string;
  [key: string]: unknown;
}

/**
 * Read Claude OAuth access token from known credential files.
 *
 * This helper does not perform any network I/O – it only reads local files
 * written by Claude integrations. If no token is found, it returns undefined.
 */
export async function readClaudeOAuthToken(): Promise<string | undefined> {
  const fromEnv = process.env.CLAUDE_OAUTH_ACCESS_TOKEN?.trim();
  if (fromEnv) {
    return fromEnv;
  }

  for (const path of CLAUDE_OAUTH_PATHS) {
    try {
      const contents = await fs.readFile(path, "utf-8");
      const parsed = JSON.parse(contents) as ClaudeCredentialFile;
      const token = (parsed.access_token ?? parsed.token)?.toString().trim();
      if (token) {
        return token;
      }
    } catch {
      // Ignore missing or malformed files and continue to next path
    }
  }

  return undefined;
}
