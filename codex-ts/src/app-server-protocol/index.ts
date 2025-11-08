/**
 * JSON-RPC protocol types for IDE/App-Server communication.
 *
 * This module provides types for JSON-RPC 2.0-style communication between
 * IDE clients and the Codex app server. We follow a JSON-RPC-like pattern
 * but do not include the "jsonrpc": "2.0" version field.
 */

/**
 * Request identifier - can be either a string or number.
 */
export type RequestId = string | number;

/**
 * A JSON-RPC request that expects a response.
 */
export interface JSONRPCRequest {
  /** Unique identifier for this request */
  id: RequestId;
  /** Method name to invoke */
  method: string;
  /** Optional parameters for the method */
  params?: unknown;
}

/**
 * A JSON-RPC notification that does not expect a response.
 */
export interface JSONRPCNotification {
  /** Method name */
  method: string;
  /** Optional parameters */
  params?: unknown;
}

/**
 * A successful (non-error) response to a request.
 */
export interface JSONRPCResponse {
  /** ID matching the original request */
  id: RequestId;
  /** Result data */
  result: unknown;
}

/**
 * Error details for a JSON-RPC error response.
 */
export interface JSONRPCErrorError {
  /** Error code (typically negative for JSON-RPC errors) */
  code: number;
  /** Error message */
  message: string;
  /** Optional additional error data */
  data?: unknown;
}

/**
 * An error response to a request.
 */
export interface JSONRPCError {
  /** ID matching the original request */
  id: RequestId;
  /** Error details */
  error: JSONRPCErrorError;
}

/**
 * Union type representing any valid JSON-RPC message.
 */
export type JSONRPCMessage =
  | JSONRPCRequest
  | JSONRPCNotification
  | JSONRPCResponse
  | JSONRPCError;

/**
 * Type guard to check if a message is a JSONRPCRequest.
 */
export function isJSONRPCRequest(msg: JSONRPCMessage): msg is JSONRPCRequest {
  return (
    "id" in msg && "method" in msg && !("result" in msg) && !("error" in msg)
  );
}

/**
 * Type guard to check if a message is a JSONRPCNotification.
 */
export function isJSONRPCNotification(
  msg: JSONRPCMessage,
): msg is JSONRPCNotification {
  return !("id" in msg) && "method" in msg;
}

/**
 * Type guard to check if a message is a JSONRPCResponse.
 */
export function isJSONRPCResponse(msg: JSONRPCMessage): msg is JSONRPCResponse {
  return "id" in msg && "result" in msg;
}

/**
 * Type guard to check if a message is a JSONRPCError.
 */
export function isJSONRPCError(msg: JSONRPCMessage): msg is JSONRPCError {
  return "id" in msg && "error" in msg;
}

/**
 * JSON-RPC version constant.
 */
export const JSONRPC_VERSION = "2.0";

/**
 * Re-export AuthMode from core/auth for convenience.
 */
export { AuthMode } from "../core/auth/index";
