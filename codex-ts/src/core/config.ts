/**
 * Configuration management for Codex.
 *
 * This module provides the core configuration structure and utilities for loading
 * and managing Codex settings. The configuration can be loaded from TOML files,
 * environment variables, and CLI overrides.
 *
 * @module core/config
 */

import { AskForApproval, SandboxPolicy } from '../protocol/protocol'
import {
  ReasoningEffort,
  ReasoningSummary,
  Verbosity,
  ForcedLoginMethod,
} from '../protocol/config-types'

/**
 * Maximum number of bytes of the documentation that will be embedded.
 * Larger files are silently truncated to this size.
 */
export const PROJECT_DOC_MAX_BYTES = 32 * 1024 // 32 KiB

/**
 * Default model for OpenAI (platform-dependent in Rust, but we'll use a single default)
 */
export const OPENAI_DEFAULT_MODEL = 'gpt-5-codex'
export const OPENAI_DEFAULT_REVIEW_MODEL = 'gpt-5-codex'
export const GPT_5_CODEX_MEDIUM_MODEL = 'gpt-5-codex'

/**
 * Configuration TOML filename
 */
export const CONFIG_TOML_FILE = 'config.toml'

/**
 * History persistence mode
 */
export enum HistoryPersistence {
  /** Save all history entries to disk */
  SaveAll = 'save-all',
  /** Do not write history to disk */
  None = 'none',
}

/**
 * Settings that govern if and what will be written to ~/.codex/history.jsonl
 */
export interface History {
  /** If None, history entries will not be written to disk */
  persistence: HistoryPersistence
  /** Optional maximum size of the history file in bytes */
  maxBytes?: number
}

export namespace History {
  export function defaultHistory(): History {
    return {
      persistence: HistoryPersistence.SaveAll,
      maxBytes: undefined,
    }
  }
}

/**
 * URI-based file opener options
 */
export enum UriBasedFileOpener {
  VsCode = 'vscode',
  VsCodeInsiders = 'vscode-insiders',
  Windsurf = 'windsurf',
  Cursor = 'cursor',
  None = 'none',
}

export namespace UriBasedFileOpener {
  /**
   * Get the URI scheme for the file opener
   */
  export function getScheme(opener: UriBasedFileOpener): string | undefined {
    switch (opener) {
      case UriBasedFileOpener.VsCode:
        return 'vscode'
      case UriBasedFileOpener.VsCodeInsiders:
        return 'vscode-insiders'
      case UriBasedFileOpener.Windsurf:
        return 'windsurf'
      case UriBasedFileOpener.Cursor:
        return 'cursor'
      case UriBasedFileOpener.None:
        return undefined
    }
  }
}

/**
 * MCP Server configuration
 *
 * Note: This is a simplified version for Phase 2. Full MCP support will be added in Phase 4.
 */
export interface McpServerConfig {
  // Simplified for now - full implementation in Phase 4
  enabled: boolean
}

/**
 * Application configuration loaded from disk and merged with overrides.
 *
 * This is a simplified version for Phase 2 that includes only the fields needed
 * for configuration loading, message history, and rollout persistence.
 * Additional fields will be added in Phase 4 and 5 as dependencies are ported.
 */
export interface Config {
  /** Optional override of model selection */
  model: string

  /** Model used specifically for review sessions */
  reviewModel: string

  /** Size of the context window for the model, in tokens */
  modelContextWindow?: number

  /** Maximum number of output tokens */
  modelMaxOutputTokens?: number

  /** Token usage threshold triggering auto-compaction of conversation history */
  modelAutoCompactTokenLimit?: number

  /** Key into the model_providers map that specifies which provider to use */
  modelProviderId: string

  /** Approval policy for executing commands */
  approvalPolicy: AskForApproval

  /** Sandbox policy */
  sandboxPolicy: SandboxPolicy

  /** True if the user passed in an override or set a value in config.toml */
  didUserSetCustomApprovalPolicyOrSandboxMode: boolean

  /** When true, AgentReasoning events will be suppressed from output */
  hideAgentReasoning: boolean

  /** When true, AgentReasoningRawContentEvent events will be shown in the UI/output */
  showRawAgentReasoning: boolean

  /** User-provided instructions from AGENTS.md */
  userInstructions?: string

  /** Base instructions override */
  baseInstructions?: string

  /** Developer instructions override injected as a separate message */
  developerInstructions?: string

  /** Compact prompt override */
  compactPrompt?: string

  /** Optional external notifier command */
  notify?: string[]

  /** The directory that should be treated as the current working directory */
  cwd: string

  /** Definition for MCP servers that Codex can reach out to for tool calls */
  mcpServers: Map<string, McpServerConfig>

  /** Maximum number of bytes to include from an AGENTS.md project doc file */
  projectDocMaxBytes: number

  /** Additional filenames to try when looking for project-level docs */
  projectDocFallbackFilenames: string[]

  /** Directory containing all Codex state (defaults to ~/.codex) */
  codexHome: string

  /** Settings that govern if and what will be written to ~/.codex/history.jsonl */
  history: History

  /** Optional URI-based file opener */
  fileOpener: UriBasedFileOpener

  /** Value to use for reasoning.effort when making a request using the Responses API */
  modelReasoningEffort?: ReasoningEffort

  /** If not "none", the value to use for reasoning.summary when making a request */
  modelReasoningSummary: ReasoningSummary

  /** Optional verbosity control for GPT-5 models */
  modelVerbosity?: Verbosity

  /** Base URL for requests to ChatGPT */
  chatgptBaseUrl: string

  /** When set, restricts ChatGPT login to a specific workspace identifier */
  forcedChatgptWorkspaceId?: string

  /** When set, restricts the login mechanism users may use */
  forcedLoginMethod?: ForcedLoginMethod

  /** Include the apply_patch tool */
  includeApplyPatchTool: boolean

  /** Enable web search tool */
  toolsWebSearchRequest: boolean
}

export namespace Config {
  /**
   * Create a new Config with default values
   *
   * @param codexHome - Directory containing all Codex state
   * @param cwd - Current working directory
   * @returns A new Config instance with defaults
   */
  export function createDefault(codexHome: string, cwd: string): Config {
    if (!codexHome) {
      throw new Error('codex_home is required')
    }
    if (!cwd) {
      throw new Error('cwd is required')
    }

    const config: Config = {} as Config

    config.model = OPENAI_DEFAULT_MODEL
    config.reviewModel = OPENAI_DEFAULT_REVIEW_MODEL
    config.modelProviderId = 'openai'
    config.approvalPolicy = 'on-failure' // AskForApproval
    config.sandboxPolicy = SandboxPolicy.newReadOnlyPolicy()
    config.didUserSetCustomApprovalPolicyOrSandboxMode = false
    config.hideAgentReasoning = false
    config.showRawAgentReasoning = false
    config.cwd = cwd
    config.mcpServers = new Map()
    config.projectDocMaxBytes = PROJECT_DOC_MAX_BYTES
    config.projectDocFallbackFilenames = []
    config.codexHome = codexHome
    config.history = History.defaultHistory()
    config.fileOpener = UriBasedFileOpener.None
    config.modelReasoningSummary = ReasoningSummary.Auto
    config.chatgptBaseUrl = 'https://chatgpt.com/backend-api/'
    config.includeApplyPatchTool = false
    config.toolsWebSearchRequest = false

    return config
  }
}
