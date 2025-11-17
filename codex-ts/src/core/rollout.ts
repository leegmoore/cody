/**
 * Rollout module: persistence and discovery of session rollout files.
 *
 * Rollouts are recorded as JSONL (JSON Lines) files that can be inspected with
 * tools like jq or any JSON viewer. Each line contains a timestamped entry.
 *
 * Directory structure: `~/.cody/sessions/YYYY/MM/DD/rollout-YYYY-MM-DDThh-mm-ss-<uuid>.jsonl`
 *
 * Ported from: codex-rs/core/src/rollout
 *
 * NOTE: This is a simplified Phase 2 implementation. Full features (async channels,
 * complex pagination, git info) will be added in Phase 4/5.
 *
 * @module core/rollout
 */

import * as fs from "fs/promises";
import * as path from "path";
import type { Config } from "./config.js";
import type { ConversationId } from "../protocol/conversation-id/index.js";
import type { ResponseItem } from "../protocol/models.js";

/** Subdirectory under ~/.cody for active sessions */
export const CONVERSATIONS_SUBDIR = "conversations";
export const SESSIONS_SUBDIR = "sessions"; // Legacy path for backward compatibility

/** Subdirectory under ~/.cody for archived sessions */
export const ARCHIVED_SESSIONS_SUBDIR = "archived_sessions";

/**
 * Session source (where the session originated)
 */
export enum SessionSource {
  CLI = "cli",
  VSCode = "vscode",
  API = "api",
}

/**
 * Metadata for a conversation session
 */
export interface SessionMeta {
  /** Conversation ID (UUID) */
  id: string;
  /** ISO 8601 timestamp when session was created */
  timestamp: string;
  /** Working directory at session start */
  cwd: string;
  /** CLI version or client identifier */
  cliVersion: string;
  /** Initial instructions/prompt (optional) */
  instructions?: string;
  /** Source of the session */
  source: SessionSource;
  /** Model provider ID */
  modelProvider?: string;
  /** Model slug */
  model?: string;
  /** Wire API identifier */
  modelProviderApi?: string;
}

/**
 * A single item in the rollout (simplified for Phase 2)
 */
export interface RolloutTurnMetadata {
  provider?: string;
  model?: string;
  tokens?: number;
}

export interface RolloutTurn {
  timestamp: number;
  items: ResponseItem[];
  metadata?: RolloutTurnMetadata;
}

export interface RolloutCompactionEntry {
  timestamp: number;
  summary: string;
  truncatedCount?: number;
}

export type RolloutItem =
  | { type: "session_meta"; data: SessionMeta }
  | { type: "message"; data: unknown }
  | { type: "response"; data: unknown }
  | { type: "event"; data: unknown }
  | { type: "turn"; data: RolloutTurn }
  | { type: "compacted"; data: RolloutCompactionEntry };

/**
 * A line in the rollout JSONL file
 */
export interface RolloutLine {
  /** ISO 8601 timestamp for this line */
  timestamp: string;
  /** The item being recorded */
  item: RolloutItem;
}

/**
 * Parameters for creating or resuming a RolloutRecorder
 */
export type RolloutRecorderParams =
  | {
      type: "create";
      conversationId: ConversationId;
      instructions?: string;
      source: SessionSource;
    }
  | {
      type: "resume";
      path: string;
    };

/**
 * Summary information for a conversation
 */
export interface ConversationItem {
  /** Absolute path to the rollout file */
  path: string;
  /** Conversation ID */
  id: string;
  /** Session metadata */
  meta?: SessionMeta;
  /** Creation timestamp */
  createdAt?: string;
  /** Last update timestamp */
  updatedAt?: string;
}

/**
 * Page of conversations (for listing)
 */
export interface ConversationsPage {
  /** Conversation items */
  items: ConversationItem[];
  /** Whether there are more results */
  hasMore: boolean;
}

export interface RolloutConversation {
  meta?: SessionMeta;
  turns: RolloutTurn[];
  compacted: RolloutCompactionEntry[];
}

export interface RolloutStore {
  createRecorder(
    config: Config,
    params: RolloutRecorderParams,
  ): Promise<RolloutRecorder>;
  listConversations(
    codexHome: string,
    limit?: number,
  ): Promise<ConversationsPage>;
  findConversationPathById(
    codexHome: string,
    idStr: string,
  ): Promise<string | undefined>;
  readConversation(path: string): Promise<RolloutConversation>;
}

export class FileRolloutStore implements RolloutStore {
  async createRecorder(
    config: Config,
    params: RolloutRecorderParams,
  ): Promise<RolloutRecorder> {
    return RolloutRecorder.create(config, params);
  }

  async listConversations(
    codexHome: string,
    limit?: number,
  ): Promise<ConversationsPage> {
    return RolloutRecorder.listConversations(codexHome, limit);
  }

  async findConversationPathById(
    codexHome: string,
    idStr: string,
  ): Promise<string | undefined> {
    return RolloutRecorder.findConversationPathById(codexHome, idStr);
  }

  async readConversation(path: string): Promise<RolloutConversation> {
    const lines = await RolloutRecorder.readRolloutHistory(path);
    return {
      meta: extractSessionMeta(lines),
      turns: extractRolloutTurns(lines),
      compacted: extractCompactedEntries(lines),
    };
  }
}

/**
 * Records all session items for a conversation and flushes them to disk.
 *
 * Rollouts are recorded as JSONL and can be inspected with tools such as:
 * ```bash
 * $ jq -C . ~/.cody/sessions/YYYY/MM/DD/rollout-2025-05-07T17-24-21-<uuid>.jsonl
 * ```
 *
 * NOTE: This is a simplified synchronous version for Phase 2.
 * The Rust version uses async channels and background tasks.
 */
export class RolloutRecorder {
  private readonly rolloutPath: string;
  // @ts-expect-error - Session metadata for future use
  private _meta?: SessionMeta;

  private constructor(rolloutPath: string, _meta?: SessionMeta) {
    this.rolloutPath = rolloutPath;
    this._meta = _meta;
  }

  /**
   * Get the path to this rollout file
   */
  getRolloutPath(): string {
    return this.rolloutPath;
  }

  /**
   * Create a new RolloutRecorder or resume an existing one.
   *
   * @param config - Configuration object
   * @param params - Creation or resume parameters
   * @returns A new RolloutRecorder instance
   * @throws Error if the sessions directory cannot be created or file cannot be opened
   */
  static async create(
    config: Config,
    params: RolloutRecorderParams,
  ): Promise<RolloutRecorder> {
    if (params.type === "create") {
      const { conversationId, instructions, source } = params;

      // Create the log file
      const { filePath, meta } = await createLogFile(
        config,
        conversationId,
        instructions,
        source,
      );

      const recorder = new RolloutRecorder(filePath, meta);

      // Write the session meta as the first line
      await recorder.writeRolloutLine({
        timestamp: new Date().toISOString(),
        item: {
          type: "session_meta",
          data: meta,
        },
      });

      return recorder;
    } else {
      // Resume from existing file
      const { path: existingPath } = params;

      // Verify file exists
      await fs.access(existingPath);

      return new RolloutRecorder(existingPath);
    }
  }

  /**
   * Record items to the rollout file.
   *
   * @param items - Items to record
   */
  async recordItems(items: RolloutItem[]): Promise<void> {
    for (const item of items) {
      await this.writeRolloutLine({
        timestamp: new Date().toISOString(),
        item,
      });
    }
  }

  async appendTurn(turn: RolloutTurn): Promise<void> {
    const payload: RolloutTurn = {
      ...turn,
      timestamp: turn.timestamp ?? Date.now(),
    };
    await this.recordItems([
      {
        type: "turn",
        data: payload,
      },
    ]);
  }

  async appendCompacted(entry: RolloutCompactionEntry): Promise<void> {
    const payload: RolloutCompactionEntry = {
      ...entry,
      timestamp: entry.timestamp ?? Date.now(),
    };
    await this.recordItems([
      {
        type: "compacted",
        data: payload,
      },
    ]);
  }

  /**
   * Write a single rollout line to the file.
   *
   * @param line - The rollout line to write
   */
  private async writeRolloutLine(line: RolloutLine): Promise<void> {
    const jsonLine = JSON.stringify(line) + "\n";
    await fs.appendFile(this.rolloutPath, jsonLine, "utf8");
  }

  /**
   * Read the rollout history from a file.
   *
   * @param filePath - Path to the rollout file
   * @returns Array of rollout items
   */
  static async readRolloutHistory(filePath: string): Promise<RolloutLine[]> {
    const content = await fs.readFile(filePath, "utf8");

    if (content.trim().length === 0) {
      return [];
    }

    const lines: RolloutLine[] = [];
    const rawLines = content.split("\n");
    for (let i = 0; i < rawLines.length; i++) {
      const trimmed = rawLines[i].trim();
      if (trimmed.length === 0) {
        continue;
      }

      try {
        const parsed = JSON.parse(trimmed) as RolloutLine;
        lines.push(parsed);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new Error(`Failed to parse rollout line ${i + 1}: ${reason}`);
      }
    }

    return lines;
  }

  /**
   * List conversations under the provided Codex home directory.
   *
   * @param codexHome - Path to ~/.cody
   * @param limit - Maximum number of conversations to return
   * @returns Page of conversations
   */
  static async listConversations(
    codexHome: string,
    limit: number = 50,
  ): Promise<ConversationsPage> {
    const files = await gatherConversationFiles(codexHome, limit * 2);
    const conversations = await collectConversationsFromFiles(files);
    conversations.sort((a, b) => {
      const bTime = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
      const aTime = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
      return bTime - aTime;
    });
    return {
      items: conversations.slice(0, limit),
      hasMore: conversations.length > limit,
    };
  }

  /**
   * Find a conversation path by its ID string.
   *
   * @param codexHome - Path to ~/.cody
   * @param idStr - Conversation ID as a string
   * @returns Path to the conversation file, or undefined if not found
   */
  static async findConversationPathById(
    codexHome: string,
    idStr: string,
  ): Promise<string | undefined> {
    const conversationsDir = path.join(codexHome, CONVERSATIONS_SUBDIR);
    const directPath = joinIfWithin(conversationsDir, `${idStr}.jsonl`);
    if (!directPath) {
      return undefined;
    }
    try {
      await fs.access(directPath);
      return directPath;
    } catch {
      // ignore, fallback to legacy structure
    }

    const sessionsDir = path.join(codexHome, SESSIONS_SUBDIR);
    try {
      await fs.access(sessionsDir);
    } catch {
      return undefined;
    }

    return await findConversationRecursive(sessionsDir, idStr);
  }

  /**
   * Archive a conversation (move to archived_sessions directory).
   *
   * @param codexHome - Path to ~/.cody
   * @param conversationPath - Path to the conversation file
   * @returns Path to the archived file
   */
  static async archiveConversation(
    codexHome: string,
    conversationPath: string,
  ): Promise<string> {
    const archivedDir = path.join(codexHome, ARCHIVED_SESSIONS_SUBDIR);
    await fs.mkdir(archivedDir, { recursive: true });

    const filename = path.basename(conversationPath);
    const archivedPath = path.join(archivedDir, filename);

    await fs.rename(conversationPath, archivedPath);
    return archivedPath;
  }

  /**
   * Delete a conversation file.
   *
   * @param conversationPath - Path to the conversation file
   */
  static async deleteConversation(conversationPath: string): Promise<void> {
    await fs.unlink(conversationPath);
  }

  /**
   * Flush any pending writes (no-op in this simplified version).
   */
  async flush(): Promise<void> {
    // In the Rust version, this ensures the background writer task has processed all items.
    // In our simplified version, writes are synchronous, so this is a no-op.
  }

  /**
   * Shutdown the recorder (no-op in this simplified version).
   */
  async shutdown(): Promise<void> {
    // In the Rust version, this shuts down the background writer task.
    // In our simplified version, this is a no-op.
  }
}

/**
 * Information about a created log file
 */
interface LogFileInfo {
  filePath: string;
  meta: SessionMeta;
}

/**
 * Create a new rollout log file in the appropriate directory.
 *
 * @param config - Configuration object
 * @param conversationId - Conversation ID
 * @param instructions - Optional initial instructions
 * @param source - Session source
 * @returns Log file information
 */
async function createLogFile(
  config: Config,
  conversationId: ConversationId,
  instructions: string | undefined,
  source: SessionSource,
): Promise<LogFileInfo> {
  const now = new Date();
  const dir = path.join(config.codexHome, CONVERSATIONS_SUBDIR);
  await fs.mkdir(dir, { recursive: true });

  const filename = `${conversationId.toString()}.jsonl`;
  const filePath = path.join(dir, filename);

  // Create the file
  await fs.writeFile(filePath, "", "utf8");

  // Build session metadata
  const meta: SessionMeta = {
    id: conversationId.toString(),
    timestamp: now.toISOString(),
    cwd: config.cwd,
    cliVersion: "0.0.1", // TODO: get from package.json
    instructions,
    source,
    modelProvider: config.modelProviderId,
    model: config.model,
    modelProviderApi: config.modelProviderApi,
  };

  return { filePath, meta };
}

/**
 * Recursively collect conversation files from the sessions directory.
 *
 * @param sessionsDir - Path to sessions directory
 * @param limit - Maximum number to collect
 * @returns Array of conversation items
 */
async function collectConversationsFromFiles(
  files: string[],
): Promise<ConversationItem[]> {
  const conversations: ConversationItem[] = [];
  const seen = new Set<string>();

  for (const file of files) {
    const conversationId = extractConversationIdFromPath(file);
    if (!conversationId || seen.has(conversationId)) {
      continue;
    }

    try {
      const lines = await RolloutRecorder.readRolloutHistory(file);
      const meta = extractSessionMeta(lines);
      const createdAt = meta?.timestamp;
      const updatedAt =
        lines.length > 0 ? lines[lines.length - 1].timestamp : createdAt;

      conversations.push({
        path: file,
        id: conversationId,
        meta,
        createdAt,
        updatedAt,
      });
      seen.add(conversationId);
    } catch (error) {
      // Skip files that can't be read
      continue;
    }
  }

  return conversations;
}

/**
 * Recursively collect rollout files from a directory.
 *
 * @param dir - Directory to search
 * @param limit - Maximum number of files to collect
 * @returns Array of file paths
 */
async function collectRolloutFilesRecursive(
  dir: string,
  limit: number,
): Promise<string[]> {
  const files: string[] = [];

  async function visit(currentDir: string): Promise<void> {
    if (files.length >= limit) {
      return;
    }

    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true });

      // Sort in reverse order (newest first - relies on YYYY/MM/DD structure)
      entries.sort((a, b) => b.name.localeCompare(a.name));

      for (const entry of entries) {
        if (files.length >= limit) {
          break;
        }

        const fullPath = path.join(currentDir, entry.name);

        if (entry.isDirectory()) {
          await visit(fullPath);
        } else if (
          entry.isFile() &&
          entry.name.startsWith("rollout-") &&
          entry.name.endsWith(".jsonl")
        ) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  await visit(dir);
  return files;
}

async function collectFlatConversationFiles(dir: string): Promise<string[]> {
  const files: Array<{ path: string; mtime: number }> = [];
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".jsonl")) {
        continue;
      }
      const fullPath = path.join(dir, entry.name);
      const stats = await fs.stat(fullPath);
      files.push({ path: fullPath, mtime: stats.mtimeMs });
    }
  } catch {
    return [];
  }

  files.sort((a, b) => b.mtime - a.mtime);
  return files.map((entry) => entry.path);
}

async function gatherConversationFiles(
  codexHome: string,
  limit: number,
): Promise<string[]> {
  const conversationDir = path.join(codexHome, CONVERSATIONS_SUBDIR);
  const legacyDir = path.join(codexHome, SESSIONS_SUBDIR);

  const flatFiles = await collectFlatConversationFiles(conversationDir);
  const legacyFiles = await collectRolloutFilesRecursive(legacyDir, limit);

  return [...flatFiles.slice(0, limit), ...legacyFiles];
}

/**
 * Find a conversation file by ID, searching recursively.
 *
 * @param dir - Directory to search
 * @param idStr - Conversation ID to find
 * @returns Path to the file, or undefined if not found
 */
async function findConversationRecursive(
  dir: string,
  idStr: string,
): Promise<string | undefined> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const found = await findConversationRecursive(fullPath, idStr);
        if (found) {
          return found;
        }
      } else if (entry.isFile() && entry.name.includes(idStr)) {
        return fullPath;
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }

  return undefined;
}

/**
 * Extract conversation ID from a rollout file path.
 *
 * Expected format: rollout-YYYY-MM-DDThh-mm-ss-<uuid>.jsonl
 *
 * @param filePath - Path to the rollout file
 * @returns Conversation ID, or undefined if not found
 */
function extractConversationIdFromPath(filePath: string): string | undefined {
  const filename = path.basename(filePath);
  if (/^[0-9a-f-]{36}\.jsonl$/.test(filename)) {
    return filename.replace(/\.jsonl$/, "");
  }
  const match = filename.match(/rollout-.*?-([0-9a-f-]{36})\.jsonl$/);
  return match ? match[1] : undefined;
}

/**
 * Extract session metadata from rollout lines.
 *
 * @param lines - Rollout lines
 * @returns Session metadata, or undefined if not found
 */
function extractSessionMeta(lines: RolloutLine[]): SessionMeta | undefined {
  for (const line of lines) {
    if (line.item.type === "session_meta") {
      return line.item.data as SessionMeta;
    }
  }
  return undefined;
}

function extractRolloutTurns(lines: RolloutLine[]): RolloutTurn[] {
  return lines
    .filter((line) => line.item.type === "turn")
    .map((line) => line.item.data as RolloutTurn);
}

function extractCompactedEntries(
  lines: RolloutLine[],
): RolloutCompactionEntry[] {
  return lines
    .filter((line) => line.item.type === "compacted")
    .map((line) => line.item.data as RolloutCompactionEntry);
}

function joinIfWithin(baseDir: string, fragment: string): string | undefined {
  const candidate = path.join(baseDir, fragment);
  const resolvedBase = path.resolve(baseDir);
  const resolvedCandidate = path.resolve(candidate);
  if (resolvedCandidate.startsWith(`${resolvedBase}${path.sep}`)) {
    return candidate;
  }
  return undefined;
}
