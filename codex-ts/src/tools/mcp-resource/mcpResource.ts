/**
 * MCP Resource tools - Access MCP server resources
 *
 * Ported from: codex-rs/core/src/tools/handlers/mcp_resource.rs
 *
 * Integrated with MCP connection manager (Phase 4.6).
 * Connection manager methods return empty results until Phase 5 implements
 * real MCP server connections.
 */

import { ToolResult } from "../types.js";
import {
  McpConnectionManager,
  mcpConnectionManager,
} from "../../core/mcp/connection-manager.js";

/**
 * MCP Resource - represents a single resource from an MCP server
 */
export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * MCP Resource with server name
 */
export interface ResourceWithServer extends McpResource {
  server: string;
}

/**
 * MCP Resource Template - resource with URI template variables
 */
export interface McpResourceTemplate {
  uriTemplate: string;
  name: string;
  description?: string;
  mimeType?: string;
}

/**
 * MCP Resource Template with server name
 */
export interface ResourceTemplateWithServer extends McpResourceTemplate {
  server: string;
}

/**
 * Parameters for list_mcp_resources operation
 */
export interface ListMcpResourcesParams {
  /** Server name to list from, or undefined to list from all servers */
  server?: string;
  /** Pagination cursor for continuing a previous list operation */
  cursor?: string;
}

/**
 * Parameters for list_mcp_resource_templates operation
 */
export interface ListMcpResourceTemplatesParams {
  /** Server name to list from, or undefined to list from all servers */
  server?: string;
  /** Pagination cursor for continuing a previous list operation */
  cursor?: string;
}

/**
 * Parameters for read_mcp_resource operation
 */
export interface ReadMcpResourceParams {
  /** Server name */
  server: string;
  /** Resource URI */
  uri: string;
}

/**
 * Result from list_mcp_resources
 */
export interface ListMcpResourcesResult {
  server?: string;
  resources: ResourceWithServer[];
  nextCursor?: string;
}

/**
 * Result from list_mcp_resource_templates
 */
export interface ListMcpResourceTemplatesResult {
  server?: string;
  resourceTemplates: ResourceTemplateWithServer[];
  nextCursor?: string;
}

/**
 * Content block from MCP resource read
 */
export interface ResourceContent {
  type: "text" | "resource";
  text?: string;
  uri?: string;
  mimeType?: string;
}

/**
 * Result from read_mcp_resource
 */
export interface ReadMcpResourceResult {
  server: string;
  uri: string;
  contents: ResourceContent[];
}

/**
 * List MCP resources from one or all servers.
 *
 * Calls the MCP connection manager to list resources. Returns empty list
 * until Phase 5 implements real MCP server connections.
 *
 * @param params - List parameters
 * @param connectionManager - Optional connection manager (for testing)
 * @returns Tool result with JSON list of resources
 */
export async function listMcpResources(
  params: ListMcpResourcesParams,
  connectionManager?: McpConnectionManager,
): Promise<ToolResult> {
  // Validate: cursor requires server
  if (params.cursor && !params.server) {
    throw new Error("cursor can only be used when a server is specified");
  }

  const manager = connectionManager ?? mcpConnectionManager;

  let result: ListMcpResourcesResult;

  if (params.server) {
    // List from specific server
    const mcpResult = await manager.listResources(params.server, {
      cursor: params.cursor,
    });
    result = {
      server: params.server,
      resources: mcpResult.resources.map((r) => ({
        server: params.server!,
        ...r,
      })),
      nextCursor: mcpResult.nextCursor,
    };
  } else {
    // List from all servers
    const allResources = await manager.listAllResources();

    // Flatten resources from all servers, sorted by server name
    const resourcesList: ResourceWithServer[] = [];
    const serverNames = Object.keys(allResources).sort();

    for (const serverName of serverNames) {
      const resources = allResources[serverName];
      for (const resource of resources) {
        resourcesList.push({
          server: serverName,
          ...resource,
        });
      }
    }

    result = {
      server: undefined,
      resources: resourcesList,
      nextCursor: undefined,
    };
  }

  return {
    content: JSON.stringify(result, null, 2),
    success: true,
  };
}

/**
 * List MCP resource templates from one or all servers.
 *
 * Resource templates are like resources but have URI templates with variables
 * that can be filled in (e.g., "file:///{path}").
 *
 * Calls the MCP connection manager to list templates. Returns empty list
 * until Phase 5 implements real MCP server connections.
 *
 * @param params - List parameters
 * @param connectionManager - Optional connection manager (for testing)
 * @returns Tool result with JSON list of resource templates
 */
export async function listMcpResourceTemplates(
  params: ListMcpResourceTemplatesParams,
  connectionManager?: McpConnectionManager,
): Promise<ToolResult> {
  // Validate: cursor requires server
  if (params.cursor && !params.server) {
    throw new Error("cursor can only be used when a server is specified");
  }

  const manager = connectionManager ?? mcpConnectionManager;

  let result: ListMcpResourceTemplatesResult;

  if (params.server) {
    // List from specific server
    const mcpResult = await manager.listResourceTemplates(params.server, {
      cursor: params.cursor,
    });
    result = {
      server: params.server,
      resourceTemplates: mcpResult.resourceTemplates.map((t) => ({
        server: params.server!,
        ...t,
      })),
      nextCursor: mcpResult.nextCursor,
    };
  } else {
    // List from all servers
    const allTemplates = await manager.listAllResourceTemplates();

    // Flatten templates from all servers, sorted by server name
    const templatesList: ResourceTemplateWithServer[] = [];
    const serverNames = Object.keys(allTemplates).sort();

    for (const serverName of serverNames) {
      const templates = allTemplates[serverName];
      for (const template of templates) {
        templatesList.push({
          server: serverName,
          ...template,
        });
      }
    }

    result = {
      server: undefined,
      resourceTemplates: templatesList,
      nextCursor: undefined,
    };
  }

  return {
    content: JSON.stringify(result, null, 2),
    success: true,
  };
}

/**
 * Read a specific MCP resource content.
 *
 * Calls the MCP connection manager to read a resource. Throws error
 * until Phase 5 implements real MCP server connections.
 *
 * @param params - Read parameters
 * @param connectionManager - Optional connection manager (for testing)
 * @returns Tool result with resource content
 */
export async function readMcpResource(
  params: ReadMcpResourceParams,
  connectionManager?: McpConnectionManager,
): Promise<ToolResult> {
  // Validate required fields
  if (!params.server) {
    throw new Error("failed to parse function arguments: missing server field");
  }

  if (!params.uri) {
    throw new Error("failed to parse function arguments: missing uri field");
  }

  const manager = connectionManager ?? mcpConnectionManager;

  // Call connection manager to read resource
  const mcpResult = await manager.readResource(params.server, params.uri);

  const result: ReadMcpResourceResult = {
    server: params.server,
    uri: params.uri,
    contents: mcpResult.contents,
  };

  return {
    content: JSON.stringify(result, null, 2),
    success: true,
  };
}

/**
 * Tool specifications for the three MCP resource operations.
 */
export const MCP_RESOURCE_TOOL_SPECS = {
  list_mcp_resources: {
    name: "list_mcp_resources",
    description: "List available resources from MCP servers",
    parameters: {
      type: "object",
      properties: {
        server: {
          type: "string",
          description:
            "Server name to list from (omit to list from all servers)",
        },
        cursor: {
          type: "string",
          description: "Pagination cursor from previous list operation",
        },
      },
      additionalProperties: false,
    },
  },
  list_mcp_resource_templates: {
    name: "list_mcp_resource_templates",
    description: "List available resource templates from MCP servers",
    parameters: {
      type: "object",
      properties: {
        server: {
          type: "string",
          description:
            "Server name to list from (omit to list from all servers)",
        },
        cursor: {
          type: "string",
          description: "Pagination cursor from previous list operation",
        },
      },
      additionalProperties: false,
    },
  },
  read_mcp_resource: {
    name: "read_mcp_resource",
    description: "Read content from a specific MCP resource",
    parameters: {
      type: "object",
      properties: {
        server: {
          type: "string",
          description: "Server name",
        },
        uri: {
          type: "string",
          description: "Resource URI",
        },
      },
      required: ["server", "uri"],
      additionalProperties: false,
    },
  },
};
