/**
 * Default execution policy (JSON-based, simplified from Rust's Starlark version)
 */

import type { PolicyConfig } from './types.js';
import { ArgType } from './types.js';
import {
  flag,
  opt,
  ARG_RFILES,
  ARG_RFILES_OR_CWD,
  ARG_WFILE,
  ARG_OPAQUE_VALUE,
  ARG_POS_INT,
  oneOrMore,
  zeroOrMore,
  single,
  literal,
} from './arg-types.js';

/**
 * Default policy covering common shell commands
 */
export const DEFAULT_POLICY: PolicyConfig = {
  programs: [
    // ls
    {
      program: 'ls',
      systemPath: ['/bin/ls', '/usr/bin/ls'],
      options: [flag('-1'), flag('-a'), flag('-l'), flag('-h'), flag('-R')],
      args: [zeroOrMore(ArgType.ReadableFilesOrCwd)],
    },

    // cat
    {
      program: 'cat',
      systemPath: ['/bin/cat', '/usr/bin/cat'],
      options: [flag('-b'), flag('-n'), flag('-t')],
      args: [oneOrMore(ArgType.ReadableFile)],
      shouldMatch: [['file.txt'], ['-n', 'file.txt']],
      shouldNotMatch: [[], ['-l', 'file.txt']],
    },

    // cp
    {
      program: 'cp',
      systemPath: ['/bin/cp', '/usr/bin/cp'],
      options: [flag('-r'), flag('-R'), flag('--recursive')],
      args: [oneOrMore(ArgType.ReadableFile), single(ArgType.WriteableFile)],
      shouldMatch: [['foo', 'bar']],
      shouldNotMatch: [['foo']],
    },

    // head
    {
      program: 'head',
      systemPath: ['/bin/head', '/usr/bin/head'],
      options: [opt('-c', ARG_POS_INT), opt('-n', ARG_POS_INT)],
      args: [oneOrMore(ArgType.ReadableFile)],
    },

    // pwd (no args, optional flags)
    {
      program: 'pwd',
      options: [flag('-L'), flag('-P')],
      args: [],
    },

    // printenv (no args variant)
    {
      program: 'printenv',
      systemPath: ['/usr/bin/printenv'],
      args: [],
      shouldMatch: [[]],
      shouldNotMatch: [['PATH']],
    },

    // printenv (single arg variant)
    {
      program: 'printenv',
      systemPath: ['/usr/bin/printenv'],
      args: [single(ArgType.OpaqueValue)],
      shouldMatch: [['PATH']],
      shouldNotMatch: [[], ['PATH', 'HOME']],
    },

    // grep
    {
      program: 'grep',
      systemPath: ['/bin/grep', '/usr/bin/grep'],
      options: [
        flag('-i'),
        flag('-v'),
        flag('-n'),
        flag('-r'),
        flag('-l'),
        opt('-A', ARG_POS_INT),
        opt('-B', ARG_POS_INT),
        opt('-C', ARG_POS_INT),
      ],
      args: [single(ArgType.OpaqueValue), zeroOrMore(ArgType.ReadableFilesOrCwd)],
    },

    // echo (any args, safe)
    {
      program: 'echo',
      systemPath: ['/bin/echo', '/usr/bin/echo'],
      args: [zeroOrMore(ArgType.OpaqueValue)],
    },

    // mkdir
    {
      program: 'mkdir',
      systemPath: ['/bin/mkdir', '/usr/bin/mkdir'],
      options: [flag('-p')],
      args: [oneOrMore(ArgType.WriteableFile)],
    },

    // rm (forbidden - too dangerous)
    {
      program: 'rm',
      forbidden: 'Command rm is forbidden for safety',
      args: [zeroOrMore(ArgType.OpaqueValue)],
    },

    // Example of forbidden deployment command
    {
      program: 'applied',
      args: [literal('deploy')],
      forbidden: 'Infrastructure Risk: command contains "applied deploy"',
      shouldMatch: [['deploy']],
      shouldNotMatch: [['lint']],
    },
  ],

  // Patterns of forbidden programs
  forbiddenPrograms: [
    {
      pattern: '^sudo$',
      reason: 'Privilege escalation commands are forbidden',
    },
  ],

  // Forbidden substrings in any argument
  forbiddenSubstrings: ['--exec', '--eval', '--command'],
};
