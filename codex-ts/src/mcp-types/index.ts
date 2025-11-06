/**
 * MCP (Model Context Protocol) type definitions
 *
 * This module provides TypeScript types for the Model Context Protocol,
 * using the official @modelcontextprotocol/sdk package as the source of truth.
 *
 * Based on: https://modelcontextprotocol.io/specification/2025-06-18/basic
 */

// Re-export all types from the official SDK
export type {
  // Protocol versions and constants
  ProgressToken,
  Cursor,
  RequestId,

  // Base types
  Request,
  RequestMeta,
  Notification,
  Result,
  EmptyResult,

  // JSON-RPC types
  JSONRPCRequest,
  JSONRPCNotification,
  JSONRPCResponse,
  JSONRPCError,
  JSONRPCMessage,

  // Initialization
  Implementation,
  ClientCapabilities,
  ServerCapabilities,
  InitializeRequest,
  InitializeResult,
  InitializedNotification,

  // Progress
  Progress,
  ProgressNotification,

  // Requests and notifications
  ClientRequest,
  ServerNotification,
  CancelledNotification,
  PingRequest,

  // Resources
  Resource,
  ResourceContents,
  TextResourceContents,
  BlobResourceContents,
  ResourceTemplate,
  ListResourcesRequest,
  ListResourcesResult,
  ListResourceTemplatesRequest,
  ListResourceTemplatesResult,
  ReadResourceRequest,
  ReadResourceResult,
  ResourceListChangedNotification,
  ResourceUpdatedNotification,
  SubscribeRequest,
  UnsubscribeRequest,

  // Prompts
  Prompt,
  PromptArgument,
  ListPromptsRequest,
  ListPromptsResult,
  GetPromptRequest,
  GetPromptResult,
  PromptListChangedNotification,
  PromptMessage,

  // Tools
  Tool,
  CallToolRequest,
  CallToolResult,
  ListToolsRequest,
  ListToolsResult,
  ToolListChangedNotification,

  // Content
  ContentBlock,
  TextContent,
  ImageContent,
  EmbeddedResource,

  // Logging
  LoggingLevel,
  LoggingMessageNotification,
  SetLevelRequest,

  // Completion
  CompleteRequest,
  CompleteResult,

  // Pagination
  PaginatedRequest,
  PaginatedResult,

  // Metadata
  BaseMetadata,
  Icon,
  Icons,

  // Roots
  ListRootsRequest,
  ListRootsResult,
  Root,
  RootsListChangedNotification,

  // Sampling
  CreateMessageRequest,
  CreateMessageResult,
  SamplingMessage,
} from '@modelcontextprotocol/sdk/types.js'

// Re-export schemas for validation
export {
  LATEST_PROTOCOL_VERSION,
  DEFAULT_NEGOTIATED_PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS,
  JSONRPC_VERSION,
  ProgressTokenSchema,
  CursorSchema,
  RequestIdSchema,
  RequestSchema,
  NotificationSchema,
  ResultSchema,
  JSONRPCRequestSchema,
  JSONRPCNotificationSchema,
  JSONRPCResponseSchema,
  JSONRPCErrorSchema,
  JSONRPCMessageSchema,
  EmptyResultSchema,
  ImplementationSchema,
  ClientCapabilitiesSchema,
  ServerCapabilitiesSchema,
  InitializeRequestSchema,
  InitializeResultSchema,
  InitializedNotificationSchema,
  ProgressSchema,
  ProgressNotificationSchema,
  ClientRequestSchema,
  ServerNotificationSchema,
  CancelledNotificationSchema,
  PingRequestSchema,
  ResourceSchema,
  ResourceContentsSchema,
  TextResourceContentsSchema,
  BlobResourceContentsSchema,
  ResourceTemplateSchema,
  ListResourcesRequestSchema,
  ListResourcesResultSchema,
  ReadResourceRequestSchema,
  ReadResourceResultSchema,
  ResourceListChangedNotificationSchema,
  ResourceUpdatedNotificationSchema,
  SubscribeRequestSchema,
  UnsubscribeRequestSchema,
  PromptSchema,
  PromptArgumentSchema,
  ListPromptsRequestSchema,
  ListPromptsResultSchema,
  GetPromptRequestSchema,
  GetPromptResultSchema,
  PromptListChangedNotificationSchema,
  ToolSchema,
  CallToolRequestSchema,
  CallToolResultSchema,
  ListToolsRequestSchema,
  ListToolsResultSchema,
  ToolListChangedNotificationSchema,
  ContentBlockSchema,
  TextContentSchema,
  ImageContentSchema,
  EmbeddedResourceSchema,
  LoggingLevelSchema,
  LoggingMessageNotificationSchema,
  SetLevelRequestSchema,
  CompleteRequestSchema,
  CompleteResultSchema,
  PaginatedRequestSchema,
  PaginatedResultSchema,
  BaseMetadataSchema,
  IconSchema,
  ListRootsRequestSchema,
  ListRootsResultSchema,
  RootSchema,
  RootsListChangedNotificationSchema,
  CreateMessageRequestSchema,
  CreateMessageResultSchema,
  SamplingMessageSchema,
} from '@modelcontextprotocol/sdk/types.js'

/**
 * MCP schema version used by this implementation.
 * Matches the Rust implementation's MCP_SCHEMA_VERSION constant.
 */
export const MCP_SCHEMA_VERSION = '2025-06-18'

// JSONRPC_VERSION is already exported above in the re-export list
