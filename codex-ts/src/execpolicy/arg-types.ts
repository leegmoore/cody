/**
 * Argument type helpers for building policies
 */

import type { ArgMatcher, Opt, OptMeta } from './types.js';
import { ArgType } from './types.js';

/**
 * Create a flag option (no argument)
 */
export function flag(name: string): Opt {
  return {
    name,
    meta: { type: 'Flag' },
  };
}

/**
 * Create an option that takes a value
 */
export function opt(name: string, argType: ArgType, required = false): Opt {
  return {
    name,
    meta: { type: 'Value', argType },
    required,
  };
}

/**
 * Create a literal argument matcher
 */
export function literal(value: string): ArgMatcher {
  return { type: 'Literal', value };
}

/**
 * Create a single argument matcher
 */
export function single(argType: ArgType): ArgMatcher {
  return { type: 'Single', argType };
}

/**
 * Create a zero-or-more argument matcher
 */
export function zeroOrMore(argType: ArgType): ArgMatcher {
  return { type: 'ZeroOrMore', argType };
}

/**
 * Create a one-or-more argument matcher
 */
export function oneOrMore(argType: ArgType): ArgMatcher {
  return { type: 'OneOrMore', argType };
}

// Common argument patterns (matching Rust default.policy constants)
export const ARG_RFILES: ArgMatcher[] = [oneOrMore(ArgType.ReadableFile)];
export const ARG_RFILES_OR_CWD: ArgMatcher[] = [
  zeroOrMore(ArgType.ReadableFilesOrCwd),
];
export const ARG_WFILE: ArgMatcher[] = [single(ArgType.WriteableFile)];
export const ARG_OPAQUE_VALUE: ArgMatcher[] = [single(ArgType.OpaqueValue)];
export const ARG_POS_INT = ArgType.PositiveInt;
