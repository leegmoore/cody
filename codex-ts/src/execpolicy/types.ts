/**
 * Type definitions for execution policy checking
 */

/**
 * Argument types that can be validated
 */
export enum ArgType {
  /** Readable file or files */
  ReadableFile = "ReadableFile",
  /** Writeable file */
  WriteableFile = "WriteableFile",
  /** Readable files, or current directory if empty */
  ReadableFilesOrCwd = "ReadableFilesOrCwd",
  /** Positive integer */
  PositiveInt = "PositiveInt",
  /** Opaque value (not validated) */
  OpaqueValue = "OpaqueValue",
  /** Literal string (must match exactly) */
  Literal = "Literal",
}

/**
 * Argument matcher patterns
 */
export type ArgMatcher =
  | { type: "Literal"; value: string }
  | { type: "Single"; argType: ArgType }
  | { type: "ZeroOrMore"; argType: ArgType }
  | { type: "OneOrMore"; argType: ArgType };

/**
 * Option metadata
 */
export type OptMeta =
  | { type: "Flag" } // No argument expected
  | { type: "Value"; argType: ArgType }; // Expects an argument

/**
 * Command-line option specification
 */
export interface Opt {
  name: string;
  meta: OptMeta;
  required?: boolean;
}

/**
 * Program specification defining allowed commands
 */
export interface ProgramSpec {
  /** Program name (e.g., "ls", "cat") */
  program: string;
  /** Absolute paths where program can be found */
  systemPath?: string[];
  /** Whether to allow option bundling (e.g., -al for -a -l) */
  optionBundling?: boolean;
  /** Whether to allow --option=value format */
  combinedFormat?: boolean;
  /** Allowed flags and options */
  options?: Opt[];
  /** Argument pattern to match */
  args?: ArgMatcher[];
  /** If set, this rule marks commands as forbidden */
  forbidden?: string;
  /** Test cases that should match */
  shouldMatch?: string[][];
  /** Test cases that should not match */
  shouldNotMatch?: string[][];
}

/**
 * Forbidden program regex rule
 */
export interface ForbiddenProgramRegex {
  pattern: string;
  reason: string;
}

/**
 * Complete execution policy
 */
export interface PolicyConfig {
  /** Program specifications */
  programs: ProgramSpec[];
  /** Forbidden program patterns */
  forbiddenPrograms?: ForbiddenProgramRegex[];
  /** Forbidden substring patterns */
  forbiddenSubstrings?: string[];
}

/**
 * An execv() call to be validated
 */
export interface ExecCall {
  program: string;
  args: string[];
}

/**
 * Matched flag in a valid execution
 */
export interface MatchedFlag {
  name: string;
}

/**
 * Matched option with value in a valid execution
 */
export interface MatchedOpt {
  name: string;
  value: string;
  argType: ArgType;
}

/**
 * Matched argument in a valid execution
 */
export interface MatchedArg {
  index: number;
  type: ArgType | { Literal: string };
  value: string;
}

/**
 * A valid execution that passed policy checks
 */
export interface ValidExec {
  program: string;
  flags: MatchedFlag[];
  opts: MatchedOpt[];
  args: MatchedArg[];
  systemPath: string[];
}

/**
 * Cause of a forbidden execution
 */
export type ForbiddenCause =
  | { type: "Program"; program: string; execCall: ExecCall }
  | { type: "Arg"; arg: string; execCall: ExecCall }
  | { type: "Exec"; exec: ValidExec };

/**
 * Result of checking an execution
 */
export type CheckResult =
  /** Command is safe to run (reads only) */
  | { result: "safe"; match: ValidExec }
  /** Command matched a rule but caller should check writeable files */
  | { result: "match"; match: ValidExec }
  /** Command is forbidden */
  | { result: "forbidden"; reason: string; cause: ForbiddenCause }
  /** Safety cannot be determined */
  | { result: "unverified"; error: string };

/**
 * Error types
 */
export class ExecPolicyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecPolicyError";
  }
}

export class NoSpecForProgramError extends ExecPolicyError {
  constructor(public readonly program: string) {
    super(`No specification found for program: ${program}`);
    this.name = "NoSpecForProgramError";
  }
}

export class UnknownOptionError extends ExecPolicyError {
  constructor(
    public readonly program: string,
    public readonly option: string,
  ) {
    super(`Unknown option '${option}' for program '${program}'`);
    this.name = "UnknownOptionError";
  }
}

export class ArgumentMismatchError extends ExecPolicyError {
  constructor(message: string) {
    super(message);
    this.name = "ArgumentMismatchError";
  }
}
