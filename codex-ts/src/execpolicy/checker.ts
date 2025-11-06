/**
 * Core execution policy checking logic
 */

import type {
  ExecCall,
  ProgramSpec,
  MatchedFlag,
  MatchedOpt,
  MatchedArg,
  ValidExec,
  CheckResult,
  OptMeta,
  ArgMatcher,
} from './types.js';
import {
  ArgType,
  ExecPolicyError,
  UnknownOptionError,
  ArgumentMismatchError,
} from './types.js';

interface PositionalArg {
  index: number;
  value: string;
}

/**
 * Check a program specification against an exec call
 */
export function checkProgramSpec(
  spec: ProgramSpec,
  execCall: ExecCall
): CheckResult {
  try {
    const validExec = matchProgramSpec(spec, execCall);

    // If spec is forbidden, return forbidden result
    if (spec.forbidden) {
      return {
        result: 'forbidden',
        reason: spec.forbidden,
        cause: { type: 'Exec', exec: validExec },
      };
    }

    // Check if any args are writeable files
    const hasWriteableFiles = validExec.args.some(
      (arg) => arg.type === ArgType.WriteableFile
    );

    if (hasWriteableFiles) {
      return { result: 'match', match: validExec };
    } else {
      return { result: 'safe', match: validExec };
    }
  } catch (err) {
    if (err instanceof ExecPolicyError) {
      return { result: 'unverified', error: err.message };
    }
    throw err;
  }
}

/**
 * Match an exec call against a program spec
 */
function matchProgramSpec(
  spec: ProgramSpec,
  execCall: ExecCall
): ValidExec {
  const allowedOptions = new Map(
    (spec.options || []).map((opt) => [opt.name, opt])
  );

  let expectingOptionValue: { name: string; argType: ArgType } | null = null;
  const positionalArgs: PositionalArg[] = [];
  const matchedFlags: MatchedFlag[] = [];
  const matchedOpts: MatchedOpt[] = [];

  for (let index = 0; index < execCall.args.length; index++) {
    const arg = execCall.args[index];

    if (expectingOptionValue) {
      // Expecting a value for the previous option
      const { name, argType } = expectingOptionValue;

      if (arg.startsWith('-')) {
        throw new ExecPolicyError(
          `Option '${name}' followed by another option '${arg}' instead of a value`
        );
      }

      matchedOpts.push({ name, value: arg, argType });
      expectingOptionValue = null;
      continue;
    }

    if (arg === '--') {
      throw new ExecPolicyError(
        `Double dash (--) is not supported yet for ${spec.program}`
      );
    }

    if (arg.startsWith('-')) {
      const opt = allowedOptions.get(arg);

      if (!opt) {
        throw new UnknownOptionError(spec.program, arg);
      }

      if (opt.meta.type === 'Flag') {
        matchedFlags.push({ name: arg });
      } else if (opt.meta.type === 'Value') {
        expectingOptionValue = { name: arg, argType: opt.meta.argType };
      }
      continue;
    }

    // Positional argument
    positionalArgs.push({ index, value: arg });
  }

  // Check if we're still expecting an option value
  if (expectingOptionValue) {
    throw new ExecPolicyError(
      `Option '${expectingOptionValue.name}' requires a value`
    );
  }

  // Match positional args against patterns
  const matchedArgs = matchArgs(positionalArgs, spec.args || []);

  return {
    program: spec.program,
    flags: matchedFlags,
    opts: matchedOpts,
    args: matchedArgs,
    systemPath: spec.systemPath || [],
  };
}

/**
 * Match positional arguments against patterns
 */
function matchArgs(
  positionalArgs: PositionalArg[],
  patterns: ArgMatcher[]
): MatchedArg[] {
  const matched: MatchedArg[] = [];
  let argIdx = 0;
  let patternIdx = 0;

  while (patternIdx < patterns.length) {
    const pattern = patterns[patternIdx];

    if (pattern.type === 'Literal') {
      if (argIdx >= positionalArgs.length) {
        throw new ArgumentMismatchError(
          `Expected literal '${pattern.value}' but ran out of arguments`
        );
      }

      const arg = positionalArgs[argIdx];
      if (arg.value !== pattern.value) {
        throw new ArgumentMismatchError(
          `Expected literal '${pattern.value}' but got '${arg.value}'`
        );
      }

      matched.push({
        index: arg.index,
        type: { Literal: pattern.value },
        value: arg.value,
      });
      argIdx++;
      patternIdx++;
    } else if (pattern.type === 'Single') {
      if (argIdx >= positionalArgs.length) {
        throw new ArgumentMismatchError(
          `Expected argument of type ${pattern.argType} but ran out of arguments`
        );
      }

      const arg = positionalArgs[argIdx];
      matched.push({
        index: arg.index,
        type: pattern.argType,
        value: arg.value,
      });
      argIdx++;
      patternIdx++;
    } else if (pattern.type === 'ZeroOrMore') {
      // Consume all remaining args if this is the last pattern
      if (patternIdx === patterns.length - 1) {
        while (argIdx < positionalArgs.length) {
          const arg = positionalArgs[argIdx];
          matched.push({
            index: arg.index,
            type: pattern.argType,
            value: arg.value,
          });
          argIdx++;
        }
      }
      patternIdx++;
    } else if (pattern.type === 'OneOrMore') {
      if (argIdx >= positionalArgs.length) {
        throw new ArgumentMismatchError(
          `Expected at least one argument of type ${pattern.argType}`
        );
      }

      // Consume at least one, and all remaining if this is the last pattern
      const arg = positionalArgs[argIdx];
      matched.push({
        index: arg.index,
        type: pattern.argType,
        value: arg.value,
      });
      argIdx++;

      if (patternIdx === patterns.length - 1) {
        while (argIdx < positionalArgs.length) {
          const arg = positionalArgs[argIdx];
          matched.push({
            index: arg.index,
            type: pattern.argType,
            value: arg.value,
          });
          argIdx++;
        }
      }
      patternIdx++;
    }
  }

  // Check if we have unconsumed arguments
  if (argIdx < positionalArgs.length) {
    throw new ArgumentMismatchError(
      `Extra arguments found: ${positionalArgs.slice(argIdx).map((a) => a.value).join(', ')}`
    );
  }

  return matched;
}
