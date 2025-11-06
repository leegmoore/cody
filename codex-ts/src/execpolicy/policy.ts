/**
 * Policy management and checking
 */

import type {
  PolicyConfig,
  ProgramSpec,
  ExecCall,
  CheckResult,
  ForbiddenProgramRegex,
} from './types.js';
import { NoSpecForProgramError } from './types.js';
import { checkProgramSpec } from './checker.js';

/**
 * Execution policy
 */
export class Policy {
  private programsByName: Map<string, ProgramSpec[]>;
  private forbiddenPrograms: ForbiddenProgramRegex[];
  private forbiddenSubstrings: string[];
  private forbiddenSubstringsRegex?: RegExp;

  constructor(config: PolicyConfig) {
    // Group programs by name (multiple specs can exist for same program)
    this.programsByName = new Map();
    for (const spec of config.programs) {
      const existing = this.programsByName.get(spec.program) || [];
      existing.push(spec);
      this.programsByName.set(spec.program, existing);
    }

    this.forbiddenPrograms = config.forbiddenPrograms || [];
    this.forbiddenSubstrings = config.forbiddenSubstrings || [];

    // Build regex for forbidden substrings
    if (this.forbiddenSubstrings.length > 0) {
      const escaped = this.forbiddenSubstrings
        .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
        .join('|');
      this.forbiddenSubstringsRegex = new RegExp(`(${escaped})`);
    }
  }

  /**
   * Check an exec call against the policy
   */
  check(execCall: ExecCall): CheckResult {
    const { program, args } = execCall;

    // Check forbidden program patterns
    for (const { pattern, reason } of this.forbiddenPrograms) {
      const regex = new RegExp(pattern);
      if (regex.test(program)) {
        return {
          result: 'forbidden',
          reason,
          cause: { type: 'Program', program, execCall },
        };
      }
    }

    // Check forbidden substrings in args
    if (this.forbiddenSubstringsRegex) {
      for (const arg of args) {
        if (this.forbiddenSubstringsRegex.test(arg)) {
          return {
            result: 'forbidden',
            reason: `arg '${arg}' contains forbidden substring`,
            cause: { type: 'Arg', arg, execCall },
          };
        }
      }
    }

    // Try to match against program specs
    const specs = this.programsByName.get(program);
    if (!specs) {
      return {
        result: 'unverified',
        error: `No specification found for program: ${program}`,
      };
    }

    // Try each spec until one matches
    let lastError: string | undefined;
    for (const spec of specs) {
      const result = checkProgramSpec(spec, execCall);
      if (result.result !== 'unverified') {
        return result;
      }
      lastError = result.error;
    }

    return {
      result: 'unverified',
      error: lastError || `No matching specification for ${program}`,
    };
  }

  /**
   * Verify that all positive examples match their specs
   */
  checkPositiveExamples(): Array<{ program: string; args: string[]; error: string }> {
    const failures: Array<{ program: string; args: string[]; error: string }> = [];

    for (const specs of this.programsByName.values()) {
      for (const spec of specs) {
        if (!spec.shouldMatch) continue;

        // Skip forbidden rules - they should match but be forbidden
        if (spec.forbidden) continue;

        for (const args of spec.shouldMatch) {
          const result = checkProgramSpec(spec, {
            program: spec.program,
            args,
          });

          if (result.result === 'unverified' || result.result === 'forbidden') {
            failures.push({
              program: spec.program,
              args,
              error: result.result === 'unverified' ? result.error : result.reason,
            });
          }
        }
      }
    }

    return failures;
  }

  /**
   * Verify that all negative examples do NOT match their specs
   */
  checkNegativeExamples(): Array<{ program: string; args: string[] }> {
    const failures: Array<{ program: string; args: string[] }> = [];

    for (const specs of this.programsByName.values()) {
      for (const spec of specs) {
        if (!spec.shouldNotMatch) continue;

        for (const args of spec.shouldNotMatch) {
          const result = checkProgramSpec(spec, {
            program: spec.program,
            args,
          });

          // Should NOT match successfully
          if (result.result === 'safe' || result.result === 'match') {
            failures.push({
              program: spec.program,
              args,
            });
          }
        }
      }
    }

    return failures;
  }
}
