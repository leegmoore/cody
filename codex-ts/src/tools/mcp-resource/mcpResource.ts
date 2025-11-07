/**
 * MCP Resource tools - Access MCP server resources
 *
 * Ported from: codex-rs/core/src/tools/handlers/mcp_resource.rs
 *
 * NOTE: MCP connection manager is stubbed (Phase 4.3).
 * These tools provide the interface for MCP resource access but return
 * stub/empty results until full MCP integration is implemented.
 */

import { ToolResult } from '../types.js'

/**
 * MCP Resource - represents a single resource from an MCP server
 */
export interface McpResource {
  uri: string
  name: string
  description?: string
  mimeType?: string
}

/**
 * MCP Resource with server name
 */
export interface ResourceWithServer extends McpResource {
  server: string
}

/**
 * MCP Resource Template - resource with URI template variables
 */
export interface McpResourceTemplate {
  uriTemplate: string
  name: string
  description?: string
  mimeType?: string
}

/**
 * MCP Resource Template with server name
 */
export interface ResourceTemplateWithServer extends McpResourceTemplate {
  server: string
}

/**
 * Parameters for list_mcp_resources operation
 */
export interface ListMcpResourcesParams {
  /** Server name to list from, or undefined to list from all servers */
  server?: string
  /** Pagination cursor for continuing a previous list operation */
  cursor?: string
}

/**
 * Parameters for list_mcp_resource_templates operation
 */
export interface ListMcpResourceTemplatesParams {
  /** Server name to list from, or undefined to list from all servers */
  server?: string
  /** Pagination cursor for continuing a previous list operation */
  cursor?: string
}

/**
 * Parameters for read_mcp_resource operation
 */
export interface ReadMcpResourceParams {
  /** Server name */
  server: string
  /** Resource URI */
  uri: string
}

/**
 * Result from list_mcp_resources
 */
export interface ListMcpResourcesResult {
  server?: string
  resources: ResourceWithServer[]
  nextCursor?: string
}

/**
 * Result from list_mcp_resource_templates
 */
export interface ListMcpResourceTemplatesResult {
  server?: string
  resourceTemplates: ResourceTemplateWithServer[]
  nextCursor?: string
}

/**
 * Content block from MCP resource read
 */
export interface ResourceContent {
  type: 'text' | 'resource'
  text?: string
  uri?: string
  mimeType?: string
}

/**
 * Result from read_mcp_resource
 */
export interface ReadMcpResourceResult {
  server: string
  uri: string
  contents: ResourceContent[]
}

/**
 * List MCP resources from one or all servers.
 *
 * NOTE: This is a stub implementation. Returns empty list until MCP
 * connection manager is fully implemented in Phase 4.3+.
 *
 * @param params - List parameters
 * @returns Tool result with JSON list of resources
 */
export async function listMcpResources(
  params: ListMcpResourcesParams,
): Promise<ToolResult> {
  // Validate: cursor requires server
  if (params.cursor && !params.server) {
    throw new Error('cursor can only be used when a server is specified')
  }

  // STUB: In full implementation, this would call MCP connection manager
  // For now, return empty list
  const result: ListMcpResourcesResult = {
    server: params.server,
    resources: [],
    nextCursor: undefined,
  }

  return {
    content: JSON.stringify(result, null, 2),
    success: true,
  }
}

/**
 * List MCP resource templates from one or all servers.
 *
 * Resource templates are like resources but have URI templates with variables
 * that can be filled in (e.g., "file:///{path}").
 *
 * NOTE: This is a stub implementation. Returns empty list until MCP
 * connection manager is fully implemented.
 *
 * @param params - List parameters
 * @returns Tool result with JSON list of resource templates
 */
export async function listMcpResourceTemplates(
  params: ListMcpResourceTemplatesParams,
): Promise<ToolResult> {
  // Validate: cursor requires server
  if (params.cursor && !params.server) {
    throw new Error('cursor can only be used when a server is specified')
  }

  // STUB: In full implementation, this would call MCP connection manager
  // For now, return empty list
  const result: ListMcpResourceTemplatesResult = {
    server: params.server,
    resourceTemplates: [],
    nextCursor: undefined,
  }

  return {
    content: JSON.stringify(result, null, 2),
    success: true,
  }
}

/**
 * Read a specific MCP resource content.
 *
 * NOTE: This is a stub implementation. Throws error until MCP
 * connection manager is fully implemented.
 *
 * @param params - Read parameters
 * @returns Tool result with resource content
 */
export async function readMcpResource(
  params: ReadMcpResourceParams,
): Promise<ToolResult> {
  // Validate required fields
  if (!params.server) {
    throw new Error('failed to parse function arguments: missing server field')
  }

  if (!params.uri) {
    throw new Error('failed to parse function arguments: missing uri field')
  }

  // STUB: In full implementation, this would read from MCP server
  // For now, return error indicating MCP is not yet available
  throw new Error(
    `MCP resource reading not yet implemented: ${params.server}::${params.uri}`,
  )
}

/**
 * Tool specifications for the three MCP resource operations.
 */
export const MCP_RESOURCE_TOOL_SPECS = {
  list_mcp_resources: {
    name: 'list_mcp_resources',
    description: 'List available resources from MCP servers',
    parameters: {
      type: 'object',
      properties: {
        server: {
          type: 'string',
          description: 'Server name to list from (omit to list from all servers)',
        },
        cursor: {
          type: 'string',
          description: 'Pagination cursor from previous list operation',
        },
      },
      additionalProperties: false,
    },
  },
  list_mcp_resource_templates: {
    name: 'list_mcp_resource_templates',
    description: 'List available resource templates from MCP servers',
    parameters: {
      type: 'object',
      properties: {
        server: {
          type: 'string',
          description: 'Server name to list from (omit to list from all servers)',
        },
        cursor: {
          type: 'string',
          description: 'Pagination cursor from previous list operation',
        },
      },
      additionalProperties: false,
    },
  },
  read_mcp_resource: {
    name: 'read_mcp_resource',
    description: 'Read content from a specific MCP resource',
    parameters: {
      type: 'object',
      properties: {
        server: {
          type: 'string',
          description: 'Server name',
        },
        uri: {
          type: 'string',
          description: 'Resource URI',
        },
      },
      required: ['server', 'uri'],
      additionalProperties: false,
    },
  },
}
