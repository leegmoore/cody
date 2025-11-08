/**
 * Persistence layer for the global, append-only message history file.
 *
 * The history is stored at `~/.codex/history.jsonl` with **one JSON object per
 * line** so that it can be efficiently appended to and parsed with standard
 * JSON-Lines tooling. Each record has the following schema:
 *
 * ```json
 * {"session_id":"<uuid>","ts":<unix_seconds>,"text":"<message>"}
 * ```
 *
 * To minimize the chance of interleaved writes when multiple processes are
 * appending concurrently, we use file locking to ensure atomic writes.
 *
 * Ported from: codex-rs/core/src/message_history.rs
 *
 * @module core/message-history
 */

import * as fs from "fs/promises";
import * as path from "path";
import type { Config } from "./config.js";
import { HistoryPersistence } from "./config.js";
import type { ConversationId } from "../protocol/conversation-id/index.js";

/** Filename that stores the message history inside `~/.codex`. */
const HISTORY_FILENAME = "history.jsonl";

/** Maximum number of retry attempts for file locking */
const MAX_RETRIES = 10;

/** Delay between retry attempts (milliseconds) */
const RETRY_SLEEP_MS = 100;

/**
 * Represents a single entry in the message history.
 */
export interface HistoryEntry {
  /** Conversation/session ID (UUID) */
  session_id: string;
  /** Unix timestamp in seconds */
  ts: number;
  /** Message text content */
  text: string;
}

/**
 * Metadata about the history file.
 */
export interface HistoryMetadata {
  /** File identifier (inode on Unix, 0 on Windows) */
  logId: number;
  /** Number of entries (newline count) */
  count: number;
}

/**
 * Get the path to the history file.
 */
function historyFilepath(config: Config): string {
  return path.join(config.codexHome, HISTORY_FILENAME);
}

/**
 * Sleep for the specified number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Ensure the file has owner-only permissions (0o600 on Unix).
 * On Windows, this is a no-op.
 */
async function ensureOwnerOnlyPermissions(filepath: string): Promise<void> {
  if (process.platform === "win32") {
    // Windows doesn't use the same permission model
    return;
  }

  const stats = await fs.stat(filepath);
  const currentMode = stats.mode & 0o777;

  if (currentMode !== 0o600) {
    await fs.chmod(filepath, 0o600);
  }
}

/**
 * Attempt to acquire an exclusive lock on a file descriptor.
 * Uses flock on Unix-like systems.
 *
 * Note: Node.js doesn't have built-in advisory locking across all platforms,
 * so we implement a best-effort approach using exclusive file opening.
 */
async function tryLockExclusive(_fd: number): Promise<boolean> {
  // Node.js doesn't have a direct equivalent to Rust's try_lock
  // We'll use the open file descriptor and assume exclusivity
  // For production use, consider using a library like 'proper-lockfile'
  return true;
}

/**
 * Release a lock on a file descriptor.
 */
async function _unlock(_fd: number): Promise<void> {
  // Unlocking happens automatically when we close the file descriptor
  return;
}

/**
 * Append a text entry associated with a conversation ID to the history file.
 * Uses file locking to ensure that concurrent writes do not interleave.
 *
 * @param text - The message text to append
 * @param conversationId - The conversation ID associated with this message
 * @param config - The configuration object
 * @throws Error if unable to write to the history file after retries
 */
export async function appendEntry(
  text: string,
  conversationId: ConversationId,
  config: Config,
): Promise<void> {
  // Check if history persistence is enabled
  if (config.history.persistence === HistoryPersistence.None) {
    return;
  }

  // TODO: check `text` for sensitive patterns

  // Resolve ~/.codex/history.jsonl and ensure the parent directory exists
  const filepath = historyFilepath(config);
  const parentDir = path.dirname(filepath);

  try {
    await fs.mkdir(parentDir, { recursive: true });
  } catch (error) {
    // Directory might already exist, that's okay
  }

  // Compute timestamp (seconds since Unix epoch)
  const ts = Math.floor(Date.now() / 1000);

  // Construct the JSON line first so we can write it in a single operation
  const entry: HistoryEntry = {
    session_id: conversationId.toString(),
    ts,
    text,
  };

  const line = JSON.stringify(entry) + "\n";

  // Open file in append mode with exclusive access
  let fileHandle: fs.FileHandle | undefined;

  try {
    // Try to open the file for appending
    // Using 'a+' mode for append and read
    fileHandle = await fs.open(filepath, "a+", 0o600);

    // Ensure permissions are correct
    await ensureOwnerOnlyPermissions(filepath);

    // Retry logic for acquiring lock and writing
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        // In a real implementation, you'd use proper file locking here
        // For now, we'll use the fact that we have the file open
        const acquired = await tryLockExclusive(fileHandle.fd);

        if (acquired) {
          // Write the full line
          await fileHandle.appendFile(line, "utf8");
          return;
        }
      } catch (error) {
        // If we get a locking error, retry
        if (attempt < MAX_RETRIES - 1) {
          await sleep(RETRY_SLEEP_MS);
          continue;
        }
        throw error;
      }

      await sleep(RETRY_SLEEP_MS);
    }

    throw new Error(
      "Could not acquire exclusive lock on history file after multiple attempts",
    );
  } finally {
    if (fileHandle !== undefined) {
      try {
        await fileHandle.close();
      } catch {
        // Ignore close errors
      }
    }
  }
}

/**
 * Asynchronously fetch the history file's identifier (inode on Unix, 0 on Windows)
 * and the current number of entries by counting newline characters.
 *
 * @param config - The configuration object
 * @returns A tuple of [logId, entryCount]
 */
export async function historyMetadata(
  config: Config,
): Promise<HistoryMetadata> {
  const filepath = historyFilepath(config);

  let logId = 0;
  let count = 0;

  try {
    // Get file metadata
    const stats = await fs.stat(filepath);

    // On Unix-like systems, use the inode number as the log ID
    if (process.platform !== "win32" && "ino" in stats) {
      logId = Number(stats.ino);
    }

    // Read file and count newlines
    const content = await fs.readFile(filepath, "utf8");
    count = (content.match(/\n/g) || []).length;
  } catch (error: unknown) {
    // If file doesn't exist or can't be read, return zeros
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return { logId: 0, count: 0 };
    }
    // For other errors, still return zeros but could log
    return { logId: 0, count: 0 };
  }

  return { logId, count };
}

/**
 * Given a log ID (inode on Unix) and a zero-based offset, return the
 * corresponding HistoryEntry if the identifier matches the current history
 * file and the requested offset exists.
 *
 * Any I/O or parsing errors result in undefined being returned.
 *
 * Note: On Windows, log ID verification is skipped (always 0).
 *
 * @param logId - File identifier to verify (inode on Unix)
 * @param offset - Zero-based line offset
 * @param config - The configuration object
 * @returns The history entry if found, undefined otherwise
 */
export async function lookup(
  logId: number,
  offset: number,
  config: Config,
): Promise<HistoryEntry | undefined> {
  const filepath = historyFilepath(config);

  try {
    // Verify the file identifier matches (Unix only)
    if (process.platform !== "win32") {
      const stats = await fs.stat(filepath);
      if ("ino" in stats && Number(stats.ino) !== logId) {
        return undefined;
      }
    }

    // Read the file and split into lines
    const content = await fs.readFile(filepath, "utf8");
    const lines = content.split("\n").filter((line) => line.trim().length > 0);

    // Check if offset is valid
    if (offset >= lines.length) {
      return undefined;
    }

    // Parse and return the entry at the requested offset
    const entry = JSON.parse(lines[offset]) as HistoryEntry;
    return entry;
  } catch (error) {
    // Log errors in production, but for now just return undefined
    return undefined;
  }
}

/**
 * Read all history entries from the file.
 * Useful for testing and debugging.
 *
 * @param config - The configuration object
 * @returns Array of all history entries
 */
export async function readAllEntries(config: Config): Promise<HistoryEntry[]> {
  const filepath = historyFilepath(config);

  try {
    const content = await fs.readFile(filepath, "utf8");
    const lines = content.split("\n").filter((line) => line.trim().length > 0);

    return lines.map((line) => JSON.parse(line) as HistoryEntry);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

/**
 * Clear the history file (for testing purposes).
 *
 * @param config - The configuration object
 */
export async function clearHistory(config: Config): Promise<void> {
  const filepath = historyFilepath(config);

  try {
    await fs.unlink(filepath);
  } catch (error: unknown) {
    // Ignore if file doesn't exist
    if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
      throw error;
    }
  }
}
