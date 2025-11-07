/**
 * MCP Resource tools - Access MCP server resources (not tools, but data)
 * Provides three operations: list, list_templates, and read
 */

export {
  listMcpResources,
  listMcpResourceTemplates,
  readMcpResource,
  type ListMcpResourcesParams,
  type ListMcpResourceTemplatesParams,
  type ReadMcpResourceParams,
  type McpResource,
  type McpResourceTemplate,
  type ResourceWithServer,
  type ResourceTemplateWithServer,
  type ListMcpResourcesResult,
  type ListMcpResourceTemplatesResult,
  type ReadMcpResourceResult,
  type ResourceContent,
  MCP_RESOURCE_TOOL_SPECS,
} from './mcpResource.js'
