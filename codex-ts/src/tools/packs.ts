/**
 * Tool Pack System - Named collections of tools for different use cases
 *
 * Tool packs provide pre-configured sets of tools optimized for specific scenarios:
 * - core-codex: Essential tools for code editing and execution
 * - anthropic-standard: Basic set aligned with Anthropic's standard tools
 * - file-ops: File system operations only
 * - research: Research and information gathering tools
 * - all: All available tools
 */

/**
 * Tool pack definitions mapping pack names to tool names.
 *
 * Special value 'null' for 'all' pack means include everything in registry.
 */
export const TOOL_PACKS: Record<string, string[] | null> = {
  // Core Codex tools - essential for code editing and execution
  'core-codex': [
    'exec',
    'applyPatch',
    'readFile',
    'listDir',
    'grepFiles',
    'fileSearch',
  ],

  // Anthropic standard tools - aligned with Claude's common tool set
  'anthropic-standard': ['exec', 'readFile', 'updatePlan', 'listDir'],

  // Research tools - for information gathering (web_search when available)
  research: [],

  // File operations only - read-only and editing tools
  'file-ops': ['readFile', 'listDir', 'grepFiles', 'applyPatch', 'fileSearch'],

  // All tools - special value indicating expose everything
  all: null,
}

/**
 * Get the list of tool names for a given pack.
 *
 * @param packName - Name of the tool pack
 * @returns Array of tool names, null for 'all' pack, or undefined if pack not found
 *
 * @example
 * ```typescript
 * const tools = getToolsFromPack('core-codex')
 * // => ['exec', 'applyPatch', 'readFile', 'listDir', 'grepFiles', 'fileSearch']
 *
 * const allTools = getToolsFromPack('all')
 * // => null (indicates all tools should be exposed)
 *
 * const unknown = getToolsFromPack('nonexistent')
 * // => undefined
 * ```
 */
export function getToolsFromPack(packName: string): string[] | null | undefined {
  return TOOL_PACKS[packName]
}

/**
 * Check if a tool pack exists.
 *
 * @param packName - Name of the tool pack
 * @returns true if the pack exists
 */
export function hasToolPack(packName: string): boolean {
  return packName in TOOL_PACKS
}

/**
 * Get all available tool pack names.
 *
 * @returns Array of pack names
 */
export function getToolPackNames(): string[] {
  return Object.keys(TOOL_PACKS)
}

/**
 * Register a custom tool pack.
 *
 * This allows users to define their own tool collections.
 *
 * @param packName - Name for the custom pack
 * @param tools - Array of tool names, or null for all tools
 *
 * @example
 * ```typescript
 * registerToolPack('my-pack', ['readFile', 'listDir', 'grepFiles'])
 * ```
 */
export function registerToolPack(packName: string, tools: string[] | null): void {
  TOOL_PACKS[packName] = tools
}

/**
 * Resolve tool names from a pack or explicit list.
 *
 * Helper function that handles both pack names and explicit tool lists.
 *
 * @param toolsOrPack - Either a pack name string, array of tool names, or null for all
 * @returns Resolved array of tool names, null for all, or undefined if pack not found
 *
 * @example
 * ```typescript
 * resolveTools('core-codex')
 * // => ['exec', 'applyPatch', ...]
 *
 * resolveTools(['readFile', 'listDir'])
 * // => ['readFile', 'listDir']
 *
 * resolveTools('all')
 * // => null
 * ```
 */
export function resolveTools(
  toolsOrPack: string | string[] | null,
): string[] | null | undefined {
  if (toolsOrPack === null) {
    return null // All tools
  }

  if (Array.isArray(toolsOrPack)) {
    return toolsOrPack // Explicit list
  }

  // Pack name - look it up
  return getToolsFromPack(toolsOrPack)
}
