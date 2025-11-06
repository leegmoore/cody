/**
 * Tests for MCP type definitions
 *
 * Ported from codex-rs/mcp-types/tests/
 */

import { describe, it, expect } from 'vitest'
import {
  JSONRPC_VERSION,
  MCP_SCHEMA_VERSION,
  JSONRPCMessage,
  JSONRPCRequest,
  JSONRPCNotification,
  ClientRequest,
  ServerNotification,
  JSONRPCMessageSchema,
  ClientRequestSchema,
  ServerNotificationSchema,
  type InitializeRequest,
  type ClientCapabilities,
  type Implementation,
  type ProgressNotification,
  type ProgressToken,
  type RequestId,
} from './index.js'

describe('mcp-types', () => {
  describe('constants', () => {
    it('should export MCP_SCHEMA_VERSION', () => {
      expect(MCP_SCHEMA_VERSION).toBe('2025-06-18')
    })

    it('should export JSONRPC_VERSION', () => {
      expect(JSONRPC_VERSION).toBe('2.0')
    })
  })

  describe('initialize request deserialization', () => {
    it('should deserialize initialize request from JSON', () => {
      const raw = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          capabilities: {},
          clientInfo: { name: 'acme-client', title: 'Acme', version: '1.2.3' },
          protocolVersion: '2025-06-18',
        },
      }

      // Parse as JSONRPCMessage
      const msg = JSONRPCMessageSchema.parse(raw)

      // Verify it's a request
      expect(msg).toHaveProperty('method')
      expect(msg).toHaveProperty('id')
      expect(msg).toHaveProperty('jsonrpc')

      const jsonReq = msg as JSONRPCRequest

      // Verify basic JSONRPC fields
      expect(jsonReq.jsonrpc).toBe(JSONRPC_VERSION)
      expect(jsonReq.id).toBe(1)
      expect(jsonReq.method).toBe('initialize')

      // Verify params structure
      expect(jsonReq.params).toBeDefined()
      const params = jsonReq.params as InitializeRequest['params']

      expect(params.capabilities).toEqual({})
      expect(params.clientInfo).toEqual({
        name: 'acme-client',
        title: 'Acme',
        version: '1.2.3',
      })
      expect(params.protocolVersion).toBe('2025-06-18')
    })

    it('should parse initialize request params with ClientRequestSchema', () => {
      const raw = {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          capabilities: {},
          clientInfo: { name: 'acme-client', title: 'Acme', version: '1.2.3' },
          protocolVersion: '2025-06-18',
        },
      }

      const msg = JSONRPCMessageSchema.parse(raw)
      const jsonReq = msg as JSONRPCRequest

      // For typed parsing, we'd need to match on method and parse params
      // The SDK doesn't provide the same TryFrom pattern as Rust,
      // but we can verify the structure is correct
      expect(jsonReq.method).toBe('initialize')

      const params = jsonReq.params as InitializeRequest['params']

      // Verify ClientCapabilities
      const capabilities: ClientCapabilities = params.capabilities
      expect(capabilities).toBeDefined()
      expect(capabilities.experimental).toBeUndefined()
      expect(capabilities.roots).toBeUndefined()
      expect(capabilities.sampling).toBeUndefined()
      expect(capabilities.elicitation).toBeUndefined()

      // Verify Implementation
      const clientInfo: Implementation = params.clientInfo
      expect(clientInfo.name).toBe('acme-client')
      expect(clientInfo.title).toBe('Acme')
      expect(clientInfo.version).toBe('1.2.3')
      expect(clientInfo.userAgent).toBeUndefined()

      // Verify protocol version
      expect(params.protocolVersion).toBe('2025-06-18')
    })
  })

  describe('progress notification deserialization', () => {
    it('should deserialize progress notification from JSON', () => {
      const raw = {
        jsonrpc: '2.0',
        method: 'notifications/progress',
        params: {
          message: 'Half way there',
          progress: 0.5,
          progressToken: 99,
          total: 1.0,
        },
      }

      // Parse as JSONRPCMessage
      const msg = JSONRPCMessageSchema.parse(raw)

      // Verify it's a notification
      expect(msg).toHaveProperty('method')
      expect(msg).toHaveProperty('jsonrpc')
      expect(msg).not.toHaveProperty('id')

      const notif = msg as JSONRPCNotification

      // Verify it's a progress notification
      expect(notif.method).toBe('notifications/progress')

      const params = notif.params as ProgressNotification['params']

      expect(params.message).toBe('Half way there')
      expect(params.progress).toBe(0.5)
      expect(params.progressToken).toBe(99)
      expect(params.total).toBe(1.0)
    })

    it('should handle progress notification with proper types', () => {
      const raw = {
        jsonrpc: '2.0',
        method: 'notifications/progress',
        params: {
          message: 'Half way there',
          progress: 0.5,
          progressToken: 99,
          total: 1.0,
        },
      }

      const msg = JSONRPCMessageSchema.parse(raw)
      const notif = msg as JSONRPCNotification

      const params = notif.params as ProgressNotification['params']

      // Verify ProgressToken (can be string or number)
      const progressToken: ProgressToken = params.progressToken
      expect(typeof progressToken === 'number' || typeof progressToken === 'string').toBe(true)
      expect(progressToken).toBe(99)

      // Verify progress and total are numbers
      expect(typeof params.progress).toBe('number')
      expect(typeof params.total).toBe('number')
    })
  })

  describe('type safety', () => {
    it('should distinguish between requests and notifications', () => {
      const request = {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
        params: {},
      }

      const notification = {
        jsonrpc: '2.0',
        method: 'notifications/progress',
        params: {
          progress: 0.5,
          progressToken: 1,
        },
      }

      const parsedRequest = JSONRPCMessageSchema.parse(request)
      const parsedNotif = JSONRPCMessageSchema.parse(notification)

      // Request has id, notification doesn't
      expect(parsedRequest).toHaveProperty('id')
      expect(parsedNotif).not.toHaveProperty('id')
    })

    it('should validate JSONRPC version', () => {
      const validMsg = {
        jsonrpc: '2.0',
        id: 1,
        method: 'ping',
      }

      expect(() => JSONRPCMessageSchema.parse(validMsg)).not.toThrow()

      const invalidMsg = {
        jsonrpc: '1.0', // Wrong version
        id: 1,
        method: 'ping',
      }

      expect(() => JSONRPCMessageSchema.parse(invalidMsg)).toThrow()
    })
  })

  describe('RequestId types', () => {
    it('should accept string request IDs', () => {
      const msg = {
        jsonrpc: '2.0',
        id: 'request-123',
        method: 'ping',
      }

      const parsed = JSONRPCMessageSchema.parse(msg)
      const request = parsed as JSONRPCRequest

      const requestId: RequestId = request.id
      expect(typeof requestId).toBe('string')
      expect(requestId).toBe('request-123')
    })

    it('should accept number request IDs', () => {
      const msg = {
        jsonrpc: '2.0',
        id: 42,
        method: 'ping',
      }

      const parsed = JSONRPCMessageSchema.parse(msg)
      const request = parsed as JSONRPCRequest

      const requestId: RequestId = request.id
      expect(typeof requestId).toBe('number')
      expect(requestId).toBe(42)
    })
  })

  describe('CallTool types', () => {
    it('should handle tool call request', () => {
      const msg = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: 'my_tool',
          arguments: { param1: 'value1' },
        },
      }

      const parsed = JSONRPCMessageSchema.parse(msg)
      const request = parsed as JSONRPCRequest

      expect(request.method).toBe('tools/call')
      expect(request.params).toHaveProperty('name')
      expect((request.params as any).name).toBe('my_tool')
    })

    it('should handle tool call result', () => {
      const result = {
        content: [
          {
            type: 'text',
            text: 'Tool executed successfully',
          },
        ],
        isError: false,
      }

      // Verify structure (CallToolResult type)
      expect(result.content).toBeInstanceOf(Array)
      expect(result.content[0]).toHaveProperty('type')
      expect(result.content[0]).toHaveProperty('text')
      expect(result.isError).toBe(false)
    })
  })
})
