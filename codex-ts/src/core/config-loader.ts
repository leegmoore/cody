/**
 * Configuration loading and layering module.
 *
 * Loads configuration from multiple sources with precedence:
 * 1. Managed preferences (highest - macOS only, not implemented in Phase 2)
 * 2. Managed config (managed_config.toml)
 * 3. Base config (config.toml - lowest)
 *
 * @module core/config-loader
 */

import { promises as fs } from 'fs'
import { join } from 'path'
import * as TOML from 'smol-toml'
import { CONFIG_TOML_FILE } from './config'

/**
 * Type representing a TOML value (any valid TOML type)
 */
export type TomlValue = unknown

/**
 * Type representing a TOML table (object with string keys)
 */
export type TomlTable = Record<string, TomlValue>

/**
 * Configuration layers loaded from different sources
 */
export interface LoadedConfigLayers {
  /** Base configuration (after merging with managed layers) */
  base: TomlTable
  /** Managed configuration layer (optional) */
  managedConfig?: TomlTable
  /** Managed preferences layer (macOS only - not implemented in Phase 2) */
  managedPreferences?: TomlTable
}

/**
 * Overrides for config loader behavior (mainly for testing)
 */
export interface LoaderOverrides {
  /** Override path to managed_config.toml */
  managedConfigPath?: string
  /** Override for managed preferences base64 (macOS only - not implemented in Phase 2) */
  managedPreferencesBase64?: string
}

/**
 * Default path for system-level managed config
 */
const CODEX_MANAGED_CONFIG_SYSTEM_PATH = '/etc/codex/managed_config.toml'

/**
 * Load configuration as a TOML value
 *
 * @param codexHome - Path to the Codex home directory
 * @returns Parsed TOML configuration
 */
export async function loadConfigAsTOML(codexHome: string): Promise<TomlTable> {
  return loadConfigAsTOMLWithOverrides(codexHome, {})
}

/**
 * Load configuration layers with overrides
 *
 * @param codexHome - Path to the Codex home directory
 * @param overrides - Loader overrides
 * @returns Configuration layers
 */
export async function loadConfigLayersWithOverrides(
  codexHome: string,
  overrides: LoaderOverrides,
): Promise<LoadedConfigLayers> {
  return loadConfigLayersInternal(codexHome, overrides)
}

/**
 * Load configuration as TOML with overrides
 *
 * @param codexHome - Path to the Codex home directory
 * @param overrides - Loader overrides
 * @returns Merged TOML configuration
 */
export async function loadConfigAsTOMLWithOverrides(
  codexHome: string,
  overrides: LoaderOverrides,
): Promise<TomlTable> {
  const layers = await loadConfigLayersInternal(codexHome, overrides)
  return applyManagedLayers(layers)
}

/**
 * Internal function to load all configuration layers
 *
 * @param codexHome - Path to the Codex home directory
 * @param overrides - Loader overrides
 * @returns Raw configuration layers
 */
async function loadConfigLayersInternal(
  codexHome: string,
  overrides: LoaderOverrides,
): Promise<LoadedConfigLayers> {
  const managedConfigPath = overrides.managedConfigPath || managedConfigDefaultPath(codexHome)

  const userConfigPath = join(codexHome, CONFIG_TOML_FILE)
  const userConfig = await readConfigFromPath(userConfigPath, true)
  const managedConfig = await readConfigFromPath(managedConfigPath, false)

  // Phase 2: Skip macOS managed preferences (will implement in Phase 4/5)
  const managedPreferences = undefined

  return {
    base: userConfig || defaultEmptyTable(),
    managedConfig,
    managedPreferences,
  }
}

/**
 * Read and parse a TOML config file
 *
 * @param path - Path to the TOML file
 * @param logMissingAsInfo - If true, log missing file as info level
 * @returns Parsed TOML table or undefined if file doesn't exist
 */
async function readConfigFromPath(
  path: string,
  logMissingAsInfo: boolean,
): Promise<TomlTable | undefined> {
  try {
    const contents = await fs.readFile(path, 'utf-8')
    try {
      const parsed = TOML.parse(contents)
      return parsed as TomlTable
    } catch (err) {
      console.error(`Failed to parse ${path}:`, err)
      throw new Error(`Failed to parse TOML config: ${err}`)
    }
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      if (logMissingAsInfo) {
        console.info(`${path} not found, using defaults`)
      } else {
        console.debug(`${path} not found`)
      }
      return undefined
    }
    console.error(`Failed to read ${path}:`, err)
    throw err
  }
}

/**
 * Merge overlay TOML into base TOML, giving overlay precedence
 *
 * Recursively merges tables. Non-table values are replaced completely.
 *
 * @param base - Base TOML value to merge into (mutated)
 * @param overlay - Overlay TOML value to merge from
 */
export function mergeTomlValues(base: TomlTable, overlay: TomlTable): void {
  // Check if both are objects (tables)
  if (isTomlTable(overlay) && isTomlTable(base)) {
    for (const [key, value] of Object.entries(overlay)) {
      if (key in base && isTomlTable(base[key]) && isTomlTable(value)) {
        // Both are tables, merge recursively
        mergeTomlValues(base[key] as TomlTable, value as TomlTable)
      } else {
        // Replace value
        base[key] = value
      }
    }
  }
}

/**
 * Check if a value is a TOML table (plain object)
 *
 * @param value - Value to check
 * @returns True if value is a TOML table
 */
function isTomlTable(value: TomlValue): value is TomlTable {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  )
}

/**
 * Get default managed config path
 *
 * @param codexHome - Path to the Codex home directory
 * @returns Path to managed config file
 */
function managedConfigDefaultPath(codexHome: string): string {
  // On Unix systems, use system path
  // On Windows, use codexHome path
  if (process.platform !== 'win32') {
    return CODEX_MANAGED_CONFIG_SYSTEM_PATH
  } else {
    return join(codexHome, 'managed_config.toml')
  }
}

/**
 * Apply managed layers on top of base configuration
 *
 * @param layers - Configuration layers
 * @returns Merged configuration
 */
function applyManagedLayers(layers: LoadedConfigLayers): TomlTable {
  const { base, managedConfig, managedPreferences } = layers

  // Create a mutable copy of base
  const result = { ...base }

  // Apply managed config layer
  if (managedConfig) {
    mergeTomlValues(result, managedConfig)
  }

  // Apply managed preferences layer (Phase 2: not implemented)
  if (managedPreferences) {
    mergeTomlValues(result, managedPreferences)
  }

  return result
}

/**
 * Create default empty TOML table
 *
 * @returns Empty TOML table
 */
function defaultEmptyTable(): TomlTable {
  return {}
}
