import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import { join } from 'path'
import * as os from 'os'
import {
  loadConfigAsTOML,
  loadConfigAsTOMLWithOverrides,
  loadConfigLayersWithOverrides,
  mergeTomlValues,
  LoadedConfigLayers,
  LoaderOverrides,
} from './config-loader'
import { CONFIG_TOML_FILE } from './config'

describe('config-loader', () => {
  let tempDir: string

  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = await fs.mkdtemp(join(os.tmpdir(), 'codex-config-test-'))
  })

  afterEach(async () => {
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true })
  })

  describe('mergeTomlValues', () => {
    it('should merge simple values with overlay taking precedence', () => {
      const base = { foo: 1, bar: 'base' }
      const overlay = { foo: 2 }

      mergeTomlValues(base, overlay)

      expect(base).toEqual({ foo: 2, bar: 'base' })
    })

    it('should merge nested tables recursively', () => {
      const base = {
        nested: {
          value: 'base',
          keep: true,
        },
      }
      const overlay = {
        nested: {
          value: 'overlay',
          extra: 'new',
        },
      }

      mergeTomlValues(base, overlay)

      expect(base).toEqual({
        nested: {
          value: 'overlay',
          keep: true,
          extra: 'new',
        },
      })
    })

    it('should add new keys from overlay', () => {
      const base = { foo: 1 }
      const overlay = { bar: 2, baz: 3 }

      mergeTomlValues(base, overlay)

      expect(base).toEqual({ foo: 1, bar: 2, baz: 3 })
    })

    it('should replace non-table values completely', () => {
      const base = { foo: [1, 2, 3] }
      const overlay = { foo: [4, 5] }

      mergeTomlValues(base, overlay)

      expect(base).toEqual({ foo: [4, 5] })
    })

    it('should handle empty overlay', () => {
      const base = { foo: 1, bar: 2 }
      const overlay = {}

      mergeTomlValues(base, overlay)

      expect(base).toEqual({ foo: 1, bar: 2 })
    })

    it('should replace scalar with table', () => {
      const base = { foo: 'string' }
      const overlay = { foo: { nested: true } }

      mergeTomlValues(base, overlay)

      expect(base).toEqual({ foo: { nested: true } })
    })
  })

  describe('loadConfigAsTOML', () => {
    it('should load and parse valid TOML config', async () => {
      const configPath = join(tempDir, CONFIG_TOML_FILE)
      await fs.writeFile(
        configPath,
        `
model = "gpt-4"
foo = 123

[nested]
value = "test"
`,
      )

      const config = await loadConfigAsTOML(tempDir)

      expect(config).toEqual({
        model: 'gpt-4',
        foo: 123,
        nested: {
          value: 'test',
        },
      })
    })

    it('should return empty object when config file does not exist', async () => {
      const config = await loadConfigAsTOML(tempDir)

      expect(config).toEqual({})
    })

    it('should throw error for invalid TOML', async () => {
      const configPath = join(tempDir, CONFIG_TOML_FILE)
      await fs.writeFile(configPath, 'invalid toml [[[')

      await expect(loadConfigAsTOML(tempDir)).rejects.toThrow()
    })
  })

  describe('loadConfigLayersWithOverrides', () => {
    it('should merge managed_config layer on top of base', async () => {
      const managedPath = join(tempDir, 'managed_config.toml')

      // Write base config
      await fs.writeFile(
        join(tempDir, CONFIG_TOML_FILE),
        `
foo = 1

[nested]
value = "base"
`,
      )

      // Write managed config
      await fs.writeFile(
        managedPath,
        `
foo = 2

[nested]
value = "managed_config"
extra = true
`,
      )

      const overrides: LoaderOverrides = {
        managedConfigPath: managedPath,
      }

      // Use the function that returns merged config
      const result = await loadConfigAsTOMLWithOverrides(tempDir, overrides)

      expect(result).toEqual({
        foo: 2,
        nested: {
          value: 'managed_config',
          extra: true,
        },
      })
    })

    it('should return empty when all layers are missing', async () => {
      const managedPath = join(tempDir, 'managed_config.toml')
      const overrides: LoaderOverrides = {
        managedConfigPath: managedPath,
      }

      const layers = await loadConfigLayersWithOverrides(tempDir, overrides)

      expect(layers.base).toEqual({})
      expect(layers.managedConfig).toBeUndefined()
    })

    it('should use base config when managed config is missing', async () => {
      await fs.writeFile(
        join(tempDir, CONFIG_TOML_FILE),
        `
model = "gpt-4"
foo = 123
`,
      )

      const managedPath = join(tempDir, 'managed_config.toml')
      const overrides: LoaderOverrides = {
        managedConfigPath: managedPath,
      }

      const layers = await loadConfigLayersWithOverrides(tempDir, overrides)

      expect(layers.base).toEqual({
        model: 'gpt-4',
        foo: 123,
      })
      expect(layers.managedConfig).toBeUndefined()
    })

    it('should handle default managed config path', async () => {
      await fs.writeFile(
        join(tempDir, CONFIG_TOML_FILE),
        `
model = "gpt-4"
`,
      )

      // No overrides - should use default path
      const layers = await loadConfigLayersWithOverrides(tempDir, {})

      expect(layers.base).toEqual({
        model: 'gpt-4',
      })
      // Managed config won't exist at default path, should be undefined
      expect(layers.managedConfig).toBeUndefined()
    })
  })
})
