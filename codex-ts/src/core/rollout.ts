/**
 * Rollout module: persistence and discovery of session rollout files.
 *
 * Rollouts are recorded as JSONL (JSON Lines) files that can be inspected with
 * tools like jq or any JSON viewer. Each line contains a timestamped entry.
 *
 * Directory structure: `~/.codex/sessions/YYYY/MM/DD/rollout-YYYY-MM-DDThh-mm-ss-<uuid>.jsonl`
 *
 * Ported from: codex-rs/core/src/rollout
 *
 * NOTE: This is a simplified Phase 2 implementation. Full features (async channels,
 * complex pagination, git info) will be added in Phase 4/5.
 *
 * @module core/rollout
 */

import * as fs from 'fs/promises'
import * as path from 'path'
import type { Config } from './config.js'
import type { ConversationId } from '../protocol/conversation-id/index.js'

/** Subdirectory under ~/.codex for active sessions */
export const SESSIONS_SUBDIR = 'sessions'

/** Subdirectory under ~/.codex for archived sessions */
export const ARCHIVED_SESSIONS_SUBDIR = 'archived_sessions'

/**
 * Session source (where the session originated)
 */
export enum SessionSource {
  CLI = 'cli',
  VSCode = 'vscode',
  API = 'api',
}

/**
 * Metadata for a conversation session
 */
export interface SessionMeta {
  /** Conversation ID (UUID) */
  id: string
  /** ISO 8601 timestamp when session was created */
  timestamp: string
  /** Working directory at session start */
  cwd: string
  /** CLI version or client identifier */
  cliVersion: string
  /** Initial instructions/prompt (optional) */
  instructions?: string
  /** Source of the session */
  source: SessionSource
  /** Model provider ID */
  modelProvider?: string
}

/**
 * A single item in the rollout (simplified for Phase 2)
 */
export interface RolloutItem {
  type: 'session_meta' | 'message' | 'response' | 'event'
  data: any
}

/**
 * A line in the rollout JSONL file
 */
export interface RolloutLine {
  /** ISO 8601 timestamp for this line */
  timestamp: string
  /** The item being recorded */
  item: RolloutItem
}

/**
 * Parameters for creating or resuming a RolloutRecorder
 */
export type RolloutRecorderParams =
  | {
      type: 'create'
      conversationId: ConversationId
      instructions?: string
      source: SessionSource
    }
  | {
      type: 'resume'
      path: string
    }

/**
 * Summary information for a conversation
 */
export interface ConversationItem {
  /** Absolute path to the rollout file */
  path: string
  /** Conversation ID */
  id: string
  /** Session metadata */
  meta?: SessionMeta
  /** Creation timestamp */
  createdAt?: string
  /** Last update timestamp */
  updatedAt?: string
}

/**
 * Page of conversations (for listing)
 */
export interface ConversationsPage {
  /** Conversation items */
  items: ConversationItem[]
  /** Whether there are more results */
  hasMore: boolean
}

/**
 * Records all session items for a conversation and flushes them to disk.
 *
 * Rollouts are recorded as JSONL and can be inspected with tools such as:
 * ```bash
 * $ jq -C . ~/.codex/sessions/YYYY/MM/DD/rollout-2025-05-07T17-24-21-<uuid>.jsonl
 * ```
 *
 * NOTE: This is a simplified synchronous version for Phase 2.
 * The Rust version uses async channels and background tasks.
 */
export class RolloutRecorder {
  private readonly rolloutPath: string
  private meta?: SessionMeta

  private constructor(rolloutPath: string, meta?: SessionMeta) {
    this.rolloutPath = rolloutPath
    this.meta = meta
  }

  /**
   * Get the path to this rollout file
   */
  getRolloutPath(): string {
    return this.rolloutPath
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
    if (params.type === 'create') {
      const { conversationId, instructions, source } = params

      // Create the log file
      const { filePath, meta } = await createLogFile(config, conversationId, instructions, source)

      const recorder = new RolloutRecorder(filePath, meta)

      // Write the session meta as the first line
      await recorder.writeRolloutLine({
        timestamp: new Date().toISOString(),
        item: {
          type: 'session_meta',
          data: meta,
        },
      })

      return recorder
    } else {
      // Resume from existing file
      const { path: existingPath } = params

      // Verify file exists
      await fs.access(existingPath)

      return new RolloutRecorder(existingPath)
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
      })
    }
  }

  /**
   * Write a single rollout line to the file.
   *
   * @param line - The rollout line to write
   */
  private async writeRolloutLine(line: RolloutLine): Promise<void> {
    const jsonLine = JSON.stringify(line) + '\n'
    await fs.appendFile(this.rolloutPath, jsonLine, 'utf8')
  }

  /**
   * Read the rollout history from a file.
   *
   * @param filePath - Path to the rollout file
   * @returns Array of rollout items
   */
  static async readRolloutHistory(filePath: string): Promise<RolloutLine[]> {
    const content = await fs.readFile(filePath, 'utf8')

    if (content.trim().length === 0) {
      return []
    }

    const lines: RolloutLine[] = []
    for (const line of content.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.length === 0) {
        continue
      }

      try {
        const parsed = JSON.parse(trimmed) as RolloutLine
        lines.push(parsed)
      } catch (error) {
        // Skip invalid lines
        console.warn(`Failed to parse rollout line: ${trimmed}`)
      }
    }

    return lines
  }

  /**
   * List conversations under the provided Codex home directory.
   *
   * @param codexHome - Path to ~/.codex
   * @param limit - Maximum number of conversations to return
   * @returns Page of conversations
   */
  static async listConversations(
    codexHome: string,
    limit: number = 50,
  ): Promise<ConversationsPage> {
    const sessionsDir = path.join(codexHome, SESSIONS_SUBDIR)

    try {
      await fs.access(sessionsDir)
    } catch {
      // Sessions directory doesn't exist
      return { items: [], hasMore: false }
    }

    const conversations = await collectConversations(sessionsDir, limit)
    return {
      items: conversations.slice(0, limit),
      hasMore: conversations.length > limit,
    }
  }

  /**
   * Find a conversation path by its ID string.
   *
   * @param codexHome - Path to ~/.codex
   * @param idStr - Conversation ID as a string
   * @returns Path to the conversation file, or undefined if not found
   */
  static async findConversationPathById(
    codexHome: string,
    idStr: string,
  ): Promise<string | undefined> {
    const sessionsDir = path.join(codexHome, SESSIONS_SUBDIR)

    try {
      await fs.access(sessionsDir)
    } catch {
      return undefined
    }

    return await findConversationRecursive(sessionsDir, idStr)
  }

  /**
   * Archive a conversation (move to archived_sessions directory).
   *
   * @param codexHome - Path to ~/.codex
   * @param conversationPath - Path to the conversation file
   * @returns Path to the archived file
   */
  static async archiveConversation(
    codexHome: string,
    conversationPath: string,
  ): Promise<string> {
    const archivedDir = path.join(codexHome, ARCHIVED_SESSIONS_SUBDIR)
    await fs.mkdir(archivedDir, { recursive: true })

    const filename = path.basename(conversationPath)
    const archivedPath = path.join(archivedDir, filename)

    await fs.rename(conversationPath, archivedPath)
    return archivedPath
  }

  /**
   * Delete a conversation file.
   *
   * @param conversationPath - Path to the conversation file
   */
  static async deleteConversation(conversationPath: string): Promise<void> {
    await fs.unlink(conversationPath)
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
  filePath: string
  meta: SessionMeta
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
  const now = new Date()

  // Create directory structure: ~/.codex/sessions/YYYY/MM/DD
  const year = now.getFullYear().toString()
  const month = (now.getMonth() + 1).toString().padStart(2, '0')
  const day = now.getDate().toString().padStart(2, '0')

  const dir = path.join(config.codexHome, SESSIONS_SUBDIR, year, month, day)
  await fs.mkdir(dir, { recursive: true })

  // Format timestamp for filename: YYYY-MM-DDThh-mm-ss
  const hour = now.getHours().toString().padStart(2, '0')
  const minute = now.getMinutes().toString().padStart(2, '0')
  const second = now.getSeconds().toString().padStart(2, '0')
  const timestamp = `${year}-${month}-${day}T${hour}-${minute}-${second}`

  const filename = `rollout-${timestamp}-${conversationId.toString()}.jsonl`
  const filePath = path.join(dir, filename)

  // Create the file
  await fs.writeFile(filePath, '', 'utf8')

  // Build session metadata
  const meta: SessionMeta = {
    id: conversationId.toString(),
    timestamp: now.toISOString(),
    cwd: config.cwd,
    cliVersion: '0.0.1', // TODO: get from package.json
    instructions,
    source,
    modelProvider: config.modelProviderId,
  }

  return { filePath, meta }
}

/**
 * Recursively collect conversation files from the sessions directory.
 *
 * @param sessionsDir - Path to sessions directory
 * @param limit - Maximum number to collect
 * @returns Array of conversation items
 */
async function collectConversations(
  sessionsDir: string,
  limit: number,
): Promise<ConversationItem[]> {
  const conversations: ConversationItem[] = []
  const files = await collectRolloutFilesRecursive(sessionsDir, limit * 2)

  for (const file of files) {
    const conversationId = extractConversationIdFromPath(file)
    if (!conversationId) {
      continue
    }

    try {
      const lines = await RolloutRecorder.readRolloutHistory(file)
      const meta = extractSessionMeta(lines)
      const createdAt = meta?.timestamp
      const updatedAt = lines.length > 0 ? lines[lines.length - 1].timestamp : createdAt

      conversations.push({
        path: file,
        id: conversationId,
        meta,
        createdAt,
        updatedAt,
      })

      // Collect one extra to know if there are more
      if (conversations.length > limit) {
        break
      }
    } catch (error) {
      // Skip files that can't be read
      continue
    }
  }

  // Sort by creation time (newest first)
  conversations.sort((a, b) => {
    if (!a.createdAt || !b.createdAt) return 0
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return conversations
}

/**
 * Recursively collect rollout files from a directory.
 *
 * @param dir - Directory to search
 * @param limit - Maximum number of files to collect
 * @returns Array of file paths
 */
async function collectRolloutFilesRecursive(dir: string, limit: number): Promise<string[]> {
  const files: string[] = []

  async function visit(currentDir: string): Promise<void> {
    if (files.length >= limit) {
      return
    }

    try {
      const entries = await fs.readdir(currentDir, { withFileTypes: true })

      // Sort in reverse order (newest first - relies on YYYY/MM/DD structure)
      entries.sort((a, b) => b.name.localeCompare(a.name))

      for (const entry of entries) {
        if (files.length >= limit) {
          break
        }

        const fullPath = path.join(currentDir, entry.name)

        if (entry.isDirectory()) {
          await visit(fullPath)
        } else if (entry.isFile() && entry.name.startsWith('rollout-') && entry.name.endsWith('.jsonl')) {
          files.push(fullPath)
        }
      }
    } catch (error) {
      // Skip directories we can't read
    }
  }

  await visit(dir)
  return files
}

/**
 * Find a conversation file by ID, searching recursively.
 *
 * @param dir - Directory to search
 * @param idStr - Conversation ID to find
 * @returns Path to the file, or undefined if not found
 */
async function findConversationRecursive(dir: string, idStr: string): Promise<string | undefined> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        const found = await findConversationRecursive(fullPath, idStr)
        if (found) {
          return found
        }
      } else if (entry.isFile() && entry.name.includes(idStr)) {
        return fullPath
      }
    }
  } catch (error) {
    // Skip directories we can't read
  }

  return undefined
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
  const filename = path.basename(filePath)
  const match = filename.match(/rollout-.*?-([0-9a-f-]{36})\.jsonl$/)
  return match ? match[1] : undefined
}

/**
 * Extract session metadata from rollout lines.
 *
 * @param lines - Rollout lines
 * @returns Session metadata, or undefined if not found
 */
function extractSessionMeta(lines: RolloutLine[]): SessionMeta | undefined {
  for (const line of lines) {
    if (line.item.type === 'session_meta') {
      return line.item.data as SessionMeta
    }
  }
  return undefined
}
