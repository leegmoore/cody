import { describe, it, expect } from 'vitest'
import {
  RequestId,
  JSONRPCRequest,
  JSONRPCNotification,
  JSONRPCResponse,
  JSONRPCError,
  JSONRPCErrorError,
  JSONRPCMessage,
  isJSONRPCRequest,
  isJSONRPCNotification,
  isJSONRPCResponse,
  isJSONRPCError,
} from './index'

describe('RequestId', () => {
  it('should create string request ID', () => {
    const id: RequestId = 'test-123'
    expect(id).toBe('test-123')
  })

  it('should create numeric request ID', () => {
    const id: RequestId = 42
    expect(id).toBe(42)
  })
})

describe('JSONRPCRequest', () => {
  it('should create request with params', () => {
    const request: JSONRPCRequest = {
      id: 'req-1',
      method: 'initialize',
      params: { version: '1.0' },
    }
    expect(request.id).toBe('req-1')
    expect(request.method).toBe('initialize')
    expect(request.params).toEqual({ version: '1.0' })
  })

  it('should create request without params', () => {
    const request: JSONRPCRequest = {
      id: 1,
      method: 'ping',
    }
    expect(request.id).toBe(1)
    expect(request.method).toBe('ping')
    expect(request.params).toBeUndefined()
  })
})

describe('JSONRPCNotification', () => {
  it('should create notification with params', () => {
    const notification: JSONRPCNotification = {
      method: 'update',
      params: { status: 'running' },
    }
    expect(notification.method).toBe('update')
    expect(notification.params).toEqual({ status: 'running' })
  })

  it('should create notification without params', () => {
    const notification: JSONRPCNotification = {
      method: 'shutdown',
    }
    expect(notification.method).toBe('shutdown')
    expect(notification.params).toBeUndefined()
  })
})

describe('JSONRPCResponse', () => {
  it('should create successful response', () => {
    const response: JSONRPCResponse = {
      id: 'req-1',
      result: { success: true, data: 'test' },
    }
    expect(response.id).toBe('req-1')
    expect(response.result).toEqual({ success: true, data: 'test' })
  })

  it('should create response with numeric ID', () => {
    const response: JSONRPCResponse = {
      id: 42,
      result: null,
    }
    expect(response.id).toBe(42)
    expect(response.result).toBeNull()
  })
})

describe('JSONRPCError', () => {
  it('should create error response', () => {
    const error: JSONRPCError = {
      id: 'req-1',
      error: {
        code: -32600,
        message: 'Invalid Request',
      },
    }
    expect(error.id).toBe('req-1')
    expect(error.error.code).toBe(-32600)
    expect(error.error.message).toBe('Invalid Request')
  })

  it('should create error with data', () => {
    const error: JSONRPCError = {
      id: 1,
      error: {
        code: -32603,
        message: 'Internal error',
        data: { details: 'Stack trace here' },
      },
    }
    expect(error.error.data).toEqual({ details: 'Stack trace here' })
  })
})

describe('Type Guards', () => {
  it('should identify JSONRPCRequest', () => {
    const request: JSONRPCMessage = {
      id: 1,
      method: 'test',
      params: {},
    }
    expect(isJSONRPCRequest(request)).toBe(true)
    expect(isJSONRPCNotification(request)).toBe(false)
    expect(isJSONRPCResponse(request)).toBe(false)
    expect(isJSONRPCError(request)).toBe(false)
  })

  it('should identify JSONRPCNotification', () => {
    const notification: JSONRPCMessage = {
      method: 'notify',
      params: {},
    }
    expect(isJSONRPCRequest(notification)).toBe(false)
    expect(isJSONRPCNotification(notification)).toBe(true)
    expect(isJSONRPCResponse(notification)).toBe(false)
    expect(isJSONRPCError(notification)).toBe(false)
  })

  it('should identify JSONRPCResponse', () => {
    const response: JSONRPCMessage = {
      id: 1,
      result: { success: true },
    }
    expect(isJSONRPCRequest(response)).toBe(false)
    expect(isJSONRPCNotification(response)).toBe(false)
    expect(isJSONRPCResponse(response)).toBe(true)
    expect(isJSONRPCError(response)).toBe(false)
  })

  it('should identify JSONRPCError', () => {
    const error: JSONRPCMessage = {
      id: 1,
      error: {
        code: -32600,
        message: 'Invalid Request',
      },
    }
    expect(isJSONRPCRequest(error)).toBe(false)
    expect(isJSONRPCNotification(error)).toBe(false)
    expect(isJSONRPCResponse(error)).toBe(false)
    expect(isJSONRPCError(error)).toBe(true)
  })
})
