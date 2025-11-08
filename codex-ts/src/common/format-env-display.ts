/**
 * Format environment variables for display, masking sensitive values.
 *
 * This function takes environment variable mappings and/or variable names
 * and formats them for display with values masked as "*****" for security.
 *
 * @param env - Optional Map of environment variable key-value pairs
 * @param envVars - Array of environment variable names to display
 * @returns Formatted string like "KEY1=*****, KEY2=*****" or "-" if empty
 *
 * @example
 * ```typescript
 * const env = new Map([['TOKEN', 'secret'], ['PATH', '/usr/bin']]);
 * formatEnvDisplay(env, []); // "PATH=*****, TOKEN=*****"
 *
 * formatEnvDisplay(null, ['API_KEY']); // "API_KEY=*****"
 *
 * formatEnvDisplay(null, []); // "-"
 * ```
 */
export function formatEnvDisplay(
  env: Map<string, string> | null | undefined,
  envVars: string[],
): string {
  const parts: string[] = [];

  // Add entries from the map
  if (env && env.size > 0) {
    const sortedKeys = Array.from(env.keys()).sort();
    parts.push(...sortedKeys.map((key) => `${key}=*****`));
  }

  // Add entries from the array
  if (envVars.length > 0) {
    parts.push(...envVars.map((varName) => `${varName}=*****`));
  }

  // Return "-" if no entries, otherwise join with ", "
  if (parts.length === 0) {
    return "-";
  }

  return parts.join(", ");
}
