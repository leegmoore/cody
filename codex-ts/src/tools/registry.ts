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
import { processExecToolCall, type ExecParams, type ExecToolCallOutput } from '../core/exec/index.js';
import { run as fileSearchRun, type FileSearchOptions, type FileSearchResults } from '../file-search/index.js';
import { ToolOptions } from './types.js';
import { SandboxType } from '../core/sandboxing/index.js';
import { type SandboxPolicy } from '../protocol/protocol.js';

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
