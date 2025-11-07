import { describe, it, expect, beforeEach } from 'vitest'
import {
  TOOL_PACKS,
  getToolsFromPack,
  hasToolPack,
  getToolPackNames,
  registerToolPack,
  resolveTools,
} from './packs.js'

describe('TOOL_PACKS', () => {
  it('should have core-codex pack', () => {
    expect(TOOL_PACKS['core-codex']).toBeDefined()
    expect(Array.isArray(TOOL_PACKS['core-codex'])).toBe(true)
  })

  it('should have anthropic-standard pack', () => {
    expect(TOOL_PACKS['anthropic-standard']).toBeDefined()
    expect(Array.isArray(TOOL_PACKS['anthropic-standard'])).toBe(true)
  })

  it('should have file-ops pack', () => {
    expect(TOOL_PACKS['file-ops']).toBeDefined()
    expect(Array.isArray(TOOL_PACKS['file-ops'])).toBe(true)
  })

  it('should have research pack', () => {
    expect(TOOL_PACKS['research']).toBeDefined()
    expect(Array.isArray(TOOL_PACKS['research'])).toBe(true)
  })

  it('should have all pack with null value', () => {
    expect(TOOL_PACKS['all']).toBeNull()
  })

  it('core-codex should include essential tools', () => {
    const pack = TOOL_PACKS['core-codex']
    expect(pack).toContain('exec')
    expect(pack).toContain('applyPatch')
    expect(pack).toContain('readFile')
    expect(pack).toContain('listDir')
  })

  it('anthropic-standard should include basic tools', () => {
    const pack = TOOL_PACKS['anthropic-standard']
    expect(pack).toContain('exec')
    expect(pack).toContain('readFile')
    expect(pack).toContain('updatePlan')
  })
})

describe('getToolsFromPack', () => {
  it('should return tool array for core-codex', () => {
    const tools = getToolsFromPack('core-codex')
    expect(Array.isArray(tools)).toBe(true)
    expect(tools).toContain('exec')
  })

  it('should return null for all pack', () => {
    const tools = getToolsFromPack('all')
    expect(tools).toBeNull()
  })

  it('should return undefined for unknown pack', () => {
    const tools = getToolsFromPack('nonexistent')
    expect(tools).toBeUndefined()
  })

  it('should return empty array for research pack', () => {
    const tools = getToolsFromPack('research')
    expect(tools).toEqual([])
  })
})

describe('hasToolPack', () => {
  it('should return true for existing pack', () => {
    expect(hasToolPack('core-codex')).toBe(true)
    expect(hasToolPack('all')).toBe(true)
  })

  it('should return false for non-existent pack', () => {
    expect(hasToolPack('nonexistent')).toBe(false)
  })

  it('should return true for all default packs', () => {
    expect(hasToolPack('core-codex')).toBe(true)
    expect(hasToolPack('anthropic-standard')).toBe(true)
    expect(hasToolPack('file-ops')).toBe(true)
    expect(hasToolPack('research')).toBe(true)
    expect(hasToolPack('all')).toBe(true)
  })
})

describe('getToolPackNames', () => {
  it('should return array of pack names', () => {
    const names = getToolPackNames()
    expect(Array.isArray(names)).toBe(true)
    expect(names.length).toBeGreaterThan(0)
  })

  it('should include all default packs', () => {
    const names = getToolPackNames()
    expect(names).toContain('core-codex')
    expect(names).toContain('anthropic-standard')
    expect(names).toContain('file-ops')
    expect(names).toContain('research')
    expect(names).toContain('all')
  })
})

describe('registerToolPack', () => {
  beforeEach(() => {
    // Clean up any test packs
    delete TOOL_PACKS['test-pack']
    delete TOOL_PACKS['custom-pack']
  })

  it('should register a new pack', () => {
    registerToolPack('test-pack', ['readFile', 'listDir'])

    expect(hasToolPack('test-pack')).toBe(true)
    expect(getToolsFromPack('test-pack')).toEqual(['readFile', 'listDir'])
  })

  it('should allow registering pack with null', () => {
    registerToolPack('custom-pack', null)

    expect(hasToolPack('custom-pack')).toBe(true)
    expect(getToolsFromPack('custom-pack')).toBeNull()
  })

  it('should overwrite existing pack', () => {
    registerToolPack('test-pack', ['readFile'])
    registerToolPack('test-pack', ['listDir', 'grepFiles'])

    expect(getToolsFromPack('test-pack')).toEqual(['listDir', 'grepFiles'])
  })
})

describe('resolveTools', () => {
  it('should resolve pack name to tool array', () => {
    const tools = resolveTools('core-codex')
    expect(Array.isArray(tools)).toBe(true)
    expect(tools).toContain('exec')
  })

  it('should return null for all pack', () => {
    const tools = resolveTools('all')
    expect(tools).toBeNull()
  })

  it('should return null when passed null', () => {
    const tools = resolveTools(null)
    expect(tools).toBeNull()
  })

  it('should return array as-is when passed array', () => {
    const input = ['readFile', 'listDir', 'grepFiles']
    const tools = resolveTools(input)
    expect(tools).toBe(input)
    expect(tools).toEqual(input)
  })

  it('should return undefined for unknown pack name', () => {
    const tools = resolveTools('nonexistent')
    expect(tools).toBeUndefined()
  })

  it('should handle empty array', () => {
    const tools = resolveTools([])
    expect(tools).toEqual([])
  })
})
