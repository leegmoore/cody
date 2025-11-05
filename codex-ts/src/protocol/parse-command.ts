/**
 * Parsed command types for shell command analysis.
 *
 * This module defines types for representing parsed shell commands,
 * categorizing them by their intent (read, list, search, or unknown).
 */

/**
 * Parsed command variants.
 *
 * Tagged union representing different types of parsed shell commands.
 * These are used to understand the intent of commands for approval
 * and sandboxing decisions.
 */
export type ParsedCommand =
  | {
      type: 'read';
      /** The original command string */
      cmd: string;
      /** Human-readable name for the command */
      name: string;
      /**
       * (Best effort) Path to the file being read by the command.
       * When possible, this is an absolute path, though when relative,
       * it should be resolved against the cwd that will be used to run
       * the command to derive the absolute path.
       */
      path: string;
    }
  | {
      type: 'list_files';
      /** The original command string */
      cmd: string;
      /** Optional path being listed */
      path?: string;
    }
  | {
      type: 'search';
      /** The original command string */
      cmd: string;
      /** Optional search query */
      query?: string;
      /** Optional path being searched */
      path?: string;
    }
  | {
      type: 'unknown';
      /** The original command string */
      cmd: string;
    };

/**
 * Create a Read parsed command.
 *
 * @param cmd - The original command string
 * @param name - Human-readable name for the command
 * @param path - Path to the file being read
 * @returns A read ParsedCommand variant
 */
export function createReadCommand(
  cmd: string,
  name: string,
  path: string
): ParsedCommand {
  return { type: 'read', cmd, name, path };
}

/**
 * Create a ListFiles parsed command.
 *
 * @param cmd - The original command string
 * @param path - Optional path being listed
 * @returns A list_files ParsedCommand variant
 */
export function createListFilesCommand(
  cmd: string,
  path?: string
): ParsedCommand {
  return { type: 'list_files', cmd, path };
}

/**
 * Create a Search parsed command.
 *
 * @param cmd - The original command string
 * @param query - Optional search query
 * @param path - Optional path being searched
 * @returns A search ParsedCommand variant
 */
export function createSearchCommand(
  cmd: string,
  query?: string,
  path?: string
): ParsedCommand {
  return { type: 'search', cmd, query, path };
}

/**
 * Create an Unknown parsed command.
 *
 * @param cmd - The original command string
 * @returns An unknown ParsedCommand variant
 */
export function createUnknownCommand(cmd: string): ParsedCommand {
  return { type: 'unknown', cmd };
}
