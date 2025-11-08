/**
 * Tool Registry - Central registry for all available tools
 *
 * This module provides a typed interface for accessing all tools
 * and is used by the script harness to expose tools to sandboxed scripts.
 */

import { applyPatch } from './apply-patch/index.js';
import { readFile, type ReadFileParams } from './read-file/index.js';
import { listDir, type ListDirParams } from './list-dir/index.js';
import { grepFiles, type GrepFilesParams } from './grep-files/index.js';
import { viewImage, type ViewImageParams } from './view-image/index.js';
import { updatePlan, type UpdatePlanParams } from './plan/index.js';
import {
  listMcpResources,
  listMcpResourceTemplates,
  readMcpResource,
  type ListMcpResourcesParams,
  type ListMcpResourceTemplatesParams,
  type ReadMcpResourceParams,
} from './mcp-resource/index.js';
import { processExecToolCall, type ExecParams, type ExecToolCallOutput } from '../core/exec/index.js';
import { run as fileSearchRun, type FileSearchOptions, type FileSearchResults } from '../file-search/index.js';
import { ToolOptions } from './types.js';
import { SandboxType } from '../core/sandboxing/index.js';
import { type SandboxPolicy } from '../protocol/protocol.js';
// Phase 4.7: Web search and document tools
import { webSearch, type WebSearchParams, type WebSearchResult } from './web/index.js';
import { fetchUrl, type FetchUrlParams, type FetchUrlResult } from './web/index.js';
import { llmChat, type LLMChatParams, type LLMChatResult } from './agents/index.js';
import { launchSync, type LaunchSyncParams, type LaunchSyncResult } from './agents/index.js';
import { launchAsync, type LaunchAsyncParams, type LaunchAsyncResult } from './agents/index.js';
import { saveToFC, type SaveToFCParams, type SaveToFCResult } from './docs/index.js';
import { fetchFromFC, type FetchFromFCParams, type FetchFromFCResult } from './docs/index.js';
import { writeFile, type WriteFileParams, type WriteFileResult } from './docs/index.js';
import { savePrompts, type SavePromptsParams, type SavePromptsResult } from './prompts/index.js';
import { getPrompts, type GetPromptsParams, type GetPromptsResult } from './prompts/index.js';

/**
 * Tool function signature
 */
export type ToolFunction<TParams = any, TResult = any> = (
  params: TParams,
  options?: ToolOptions
) => Promise<TResult>;

/**
 * Tool metadata for validation and documentation
 */
export interface ToolMetadata {
  name: string;
  description: string;
  requiresApproval: boolean;
  schema?: Record<string, any>; // JSON schema for parameters
}

/**
 * Registered tool with metadata and execution function
 */
export interface RegisteredTool<TParams = any, TResult = any> {
  metadata: ToolMetadata;
  execute: ToolFunction<TParams, TResult>;
}

/**
 * Tool Registry class
 */
export class ToolRegistry {
  private tools = new Map<string, RegisteredTool>();

  constructor() {
    this.registerDefaultTools();
  }

  /**
   * Register default tools
   */
  private registerDefaultTools(): void {
    // Apply Patch tool
    this.register({
      metadata: {
        name: 'applyPatch',
        description: 'Apply a unified diff patch to files',
        requiresApproval: false,
      },
      execute: async (params: { patch: string; cwd?: string }) => {
        const result = await applyPatch(params.patch, { cwd: params.cwd });
        return result;
      },
    });

    // Read File tool
    this.register({
      metadata: {
        name: 'readFile',
        description: 'Read file contents with various modes (slice or indentation)',
        requiresApproval: false,
      },
      execute: async (params: ReadFileParams) => {
        return await readFile(params);
      },
    });

    // List Directory tool
    this.register({
      metadata: {
        name: 'listDir',
        description: 'List directory contents recursively',
        requiresApproval: false,
      },
      execute: async (params: ListDirParams) => {
        return await listDir(params);
      },
    });

    // Grep Files tool
    this.register({
      metadata: {
        name: 'grepFiles',
        description: 'Search for patterns in files using ripgrep',
        requiresApproval: false,
      },
      execute: async (params: GrepFilesParams) => {
        return await grepFiles(params, { cwd: process.cwd() });
      },
    });

    // Exec tool (requires approval)
    this.register({
      metadata: {
        name: 'exec',
        description: 'Execute a command in a sandboxed environment',
        requiresApproval: true,
      },
      execute: async (params: { command: string[]; cwd?: string; env?: Record<string, string>; timeoutMs?: number }): Promise<ExecToolCallOutput> => {
        const execParams: ExecParams = {
          command: params.command,
          cwd: params.cwd || process.cwd(),
          env: params.env || {},
          timeoutMs: params.timeoutMs,
        };
        const policy: SandboxPolicy = { mode: "read-only" }; // Default to read-only sandbox
        return await processExecToolCall(
          execParams,
          SandboxType.None, // Default to no sandboxing - can be configured
          policy,
          process.cwd(), // Sandbox CWD
          undefined // No custom sandbox exe
        );
      },
    });

    // File Search tool
    this.register({
      metadata: {
        name: 'fileSearch',
        description: 'Fast fuzzy file search',
        requiresApproval: false,
      },
      execute: async (params: { pattern: string; limit?: number; searchDirectory?: string; exclude?: string[] }, options?: ToolOptions): Promise<FileSearchResults> => {
        const searchOptions: FileSearchOptions = {
          pattern: params.pattern,
          limit: params.limit,
          searchDirectory: params.searchDirectory,
          exclude: params.exclude,
          signal: options?.signal,
        };
        return await fileSearchRun(searchOptions);
      },
    });

    // View Image tool
    this.register({
      metadata: {
        name: 'viewImage',
        description: 'Validate and prepare an image for viewing in the conversation',
        requiresApproval: false,
      },
      execute: async (params: ViewImageParams) => {
        return await viewImage(params);
      },
    });

    // Plan (update_plan) tool
    this.register({
      metadata: {
        name: 'updatePlan',
        description: 'Update the task plan with structured steps. At most one step can be in_progress at a time.',
        requiresApproval: false,
      },
      execute: async (params: UpdatePlanParams) => {
        return await updatePlan(params);
      },
    });

    // MCP Resource tools (3 operations)
    this.register({
      metadata: {
        name: 'listMcpResources',
        description: 'List available resources from MCP servers',
        requiresApproval: false,
      },
      execute: async (params: ListMcpResourcesParams) => {
        return await listMcpResources(params);
      },
    });

    this.register({
      metadata: {
        name: 'listMcpResourceTemplates',
        description: 'List available resource templates from MCP servers',
        requiresApproval: false,
      },
      execute: async (params: ListMcpResourceTemplatesParams) => {
        return await listMcpResourceTemplates(params);
      },
    });

    this.register({
      metadata: {
        name: 'readMcpResource',
        description: 'Read content from a specific MCP resource',
        requiresApproval: false,
      },
      execute: async (params: ReadMcpResourceParams) => {
        return await readMcpResource(params);
      },
    });

    // Phase 4.7: Web Search & Document Tools

    // Web Search tool
    this.register({
      metadata: {
        name: 'webSearch',
        description: 'Search the web using Perplexity API with ranked results',
        requiresApproval: false,
      },
      execute: async (params: WebSearchParams): Promise<WebSearchResult> => {
        return await webSearch(params);
      },
    });

    // Fetch URL tool
    this.register({
      metadata: {
        name: 'fetchUrl',
        description: 'Fetch URL content via Firecrawl with caching',
        requiresApproval: false,
      },
      execute: async (params: FetchUrlParams): Promise<FetchUrlResult> => {
        return await fetchUrl(params);
      },
    });

    // LLM Chat tool
    this.register({
      metadata: {
        name: 'llmChat',
        description: 'Single-shot LLM call using OpenRouter',
        requiresApproval: false,
      },
      execute: async (params: LLMChatParams): Promise<LLMChatResult> => {
        return await llmChat(params);
      },
    });

    // Agent Launch Sync tool
    this.register({
      metadata: {
        name: 'launchSync',
        description: 'Launch synchronous agent (waits for completion) [STUB]',
        requiresApproval: false,
      },
      execute: async (params: LaunchSyncParams): Promise<LaunchSyncResult> => {
        return await launchSync(params);
      },
    });

    // Agent Launch Async tool
    this.register({
      metadata: {
        name: 'launchAsync',
        description: 'Launch asynchronous agent (background execution) [STUB]',
        requiresApproval: false,
      },
      execute: async (params: LaunchAsyncParams): Promise<LaunchAsyncResult> => {
        return await launchAsync(params);
      },
    });

    // Save to File Cabinet tool
    this.register({
      metadata: {
        name: 'saveToFC',
        description: 'Save fileKey to File Cabinet (30 day storage) [STUB]',
        requiresApproval: false,
      },
      execute: async (params: SaveToFCParams): Promise<SaveToFCResult> => {
        return await saveToFC(params);
      },
    });

    // Fetch from File Cabinet tool
    this.register({
      metadata: {
        name: 'fetchFromFC',
        description: 'Retrieve content by fileKey from File Cabinet [STUB]',
        requiresApproval: false,
      },
      execute: async (params: FetchFromFCParams): Promise<FetchFromFCResult> => {
        return await fetchFromFC(params);
      },
    });

    // Write File tool
    this.register({
      metadata: {
        name: 'writeFile',
        description: 'Write fileKey content to filesystem [STUB]',
        requiresApproval: false,
      },
      execute: async (params: WriteFileParams): Promise<WriteFileResult> => {
        return await writeFile(params);
      },
    });

    // Save Prompts tool
    this.register({
      metadata: {
        name: 'savePrompts',
        description: 'Store prompts in cache and return promptKeys [STUB]',
        requiresApproval: false,
      },
      execute: async (params: SavePromptsParams): Promise<SavePromptsResult> => {
        return await savePrompts(params);
      },
    });

    // Get Prompts tool
    this.register({
      metadata: {
        name: 'getPrompts',
        description: 'Retrieve prompts by keys [STUB]',
        requiresApproval: false,
      },
      execute: async (params: GetPromptsParams): Promise<GetPromptsResult> => {
        return await getPrompts(params);
      },
    });
  }

  /**
   * Register a tool
   */
  register<TParams, TResult>(tool: RegisteredTool<TParams, TResult>): void {
    this.tools.set(tool.metadata.name, tool);
  }

  /**
   * Get a tool by name
   */
  get(name: string): RegisteredTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all registered tool names
   */
  getToolNames(): string[] {
    return Array.from(this.tools.keys());
  }

  /**
   * Check if a tool exists
   */
  has(name: string): boolean {
    return this.tools.has(name);
  }

  /**
   * Get all tools
   */
  getAll(): Map<string, RegisteredTool> {
    return new Map(this.tools);
  }
}

/**
 * Global tool registry instance
 */
export const toolRegistry = new ToolRegistry();
