import { describe, it, expect, beforeEach } from 'vitest'
import { ToolRegistry } from './registry.js'
import { getToolsFromPack, hasToolPack, resolveTools } from './packs.js'
import {
  listMcpResources,
  listMcpResourceTemplates,
  readMcpResource,
  type McpResource,
  type McpResourceTemplate,
} from './mcp-resource/index.js'
import {
  type ListResourcesResult,
  type ListResourceTemplatesResult,
  type ReadResourceResult,
} from '../core/mcp/connection-manager.js'

describe('Tool Pack Integration', () => {
  let registry: ToolRegistry

  beforeEach(() => {
    registry = new ToolRegistry()
  })

  it('INT-01: core-codex pack includes essential tools', () => {
    const tools = getToolsFromPack('core-codex')

    expect(tools).toContain('exec')
    expect(tools).toContain('applyPatch')
    expect(tools).toContain('readFile')
    expect(tools).toContain('listDir')
    expect(tools).toContain('grepFiles')
    expect(tools).toContain('fileSearch')
  })

  it('INT-02: anthropic-standard pack includes Claude tools', () => {
    const tools = getToolsFromPack('anthropic-standard')

    expect(tools).toContain('exec')
    expect(tools).toContain('readFile')
    expect(tools).toContain('updatePlan')
    expect(tools).toContain('listDir')
  })

  it('INT-03: file-ops pack excludes execution tools', () => {
    const tools = getToolsFromPack('file-ops')

    expect(tools).not.toContain('exec')
    expect(tools).toContain('readFile')
    expect(tools).toContain('listDir')
    expect(tools).toContain('grepFiles')
    expect(tools).toContain('applyPatch')
  })

  it('INT-04: all pack resolves to null (all tools)', () => {
    const tools = getToolsFromPack('all')

    expect(tools).toBeNull()
  })

  it('INT-05: registry contains all pack tools', () => {
    const packTools = getToolsFromPack('core-codex')!

    for (const toolName of packTools) {
      expect(registry.has(toolName)).toBe(true)
    }
  })
})

describe('MCP Resource Integration', () => {
  let mockManager: MockMcpConnectionManager

  beforeEach(() => {
    mockManager = new MockMcpConnectionManager()
  })

  it('INT-06: listMcpResources calls connection manager for specific server', async () => {
    mockManager.setResources('server1', [
      { uri: 'file:///test.txt', name: 'test.txt' },
    ])

    const result = await listMcpResources(
      { server: 'server1' },
      mockManager as any,
    )

    expect(result.success).toBe(true)
    const data = JSON.parse(result.content)
    expect(data.server).toBe('server1')
    expect(data.resources).toHaveLength(1)
    expect(data.resources[0].uri).toBe('file:///test.txt')
  })

  it('INT-07: listMcpResources aggregates from all servers', async () => {
    mockManager.setResources('server1', [
      { uri: 'file:///a.txt', name: 'a.txt' },
    ])
    mockManager.setResources('server2', [
      { uri: 'file:///b.txt', name: 'b.txt' },
    ])

    const result = await listMcpResources({}, mockManager as any)

    expect(result.success).toBe(true)
    const data = JSON.parse(result.content)
    expect(data.resources).toHaveLength(2)
    expect(data.resources[0].server).toBe('server1')
    expect(data.resources[1].server).toBe('server2')
  })

  it('INT-08: listMcpResources handles pagination cursor', async () => {
    mockManager.setResourcesWithCursor('server1', [
      { uri: 'file:///test.txt', name: 'test.txt' },
    ], 'next-cursor')

    const result = await listMcpResources(
      { server: 'server1', cursor: 'my-cursor' },
      mockManager as any,
    )

    expect(result.success).toBe(true)
    const data = JSON.parse(result.content)
    expect(data.nextCursor).toBe('next-cursor')
    expect(mockManager.lastCursor).toBe('my-cursor')
  })

  it('INT-09: listMcpResourceTemplates calls connection manager', async () => {
    mockManager.setTemplates('server1', [
      { uriTemplate: 'file:///{path}', name: 'file-template' },
    ])

    const result = await listMcpResourceTemplates(
      { server: 'server1' },
      mockManager as any,
    )

    expect(result.success).toBe(true)
    const data = JSON.parse(result.content)
    expect(data.resourceTemplates).toHaveLength(1)
    expect(data.resourceTemplates[0].uriTemplate).toBe('file:///{path}')
  })

  it('INT-10: listMcpResourceTemplates aggregates from all servers', async () => {
    mockManager.setTemplates('server1', [
      { uriTemplate: 'file:///{path}', name: 'file' },
    ])
    mockManager.setTemplates('server2', [
      { uriTemplate: 'http://{url}', name: 'http' },
    ])

    const result = await listMcpResourceTemplates({}, mockManager as any)

    expect(result.success).toBe(true)
    const data = JSON.parse(result.content)
    expect(data.resourceTemplates).toHaveLength(2)
  })

  it('INT-11: readMcpResource calls connection manager', async () => {
    mockManager.setResourceContent('server1', 'file:///test.txt', [
      { type: 'text', text: 'Hello world' },
    ])

    const result = await readMcpResource(
      { server: 'server1', uri: 'file:///test.txt' },
      mockManager as any,
    )

    expect(result.success).toBe(true)
    const data = JSON.parse(result.content)
    expect(data.server).toBe('server1')
    expect(data.uri).toBe('file:///test.txt')
    expect(data.contents).toHaveLength(1)
    expect(data.contents[0].text).toBe('Hello world')
  })

  it('INT-12: readMcpResource throws for missing resource', async () => {
    await expect(
      readMcpResource(
        { server: 'server1', uri: 'file:///missing.txt' },
        mockManager as any,
      ),
    ).rejects.toThrow('not yet implemented')
  })

  it('INT-13: listMcpResources returns empty for non-existent server', async () => {
    const result = await listMcpResources(
      { server: 'nonexistent' },
      mockManager as any,
    )

    expect(result.success).toBe(true)
    const data = JSON.parse(result.content)
    expect(data.resources).toHaveLength(0)
  })

  it('INT-14: listMcpResourceTemplates returns empty for non-existent server', async () => {
    const result = await listMcpResourceTemplates(
      { server: 'nonexistent' },
      mockManager as any,
    )

    expect(result.success).toBe(true)
    const data = JSON.parse(result.content)
    expect(data.resourceTemplates).toHaveLength(0)
  })

  it('INT-15: MCP tools sort servers alphabetically', async () => {
    mockManager.setResources('zebra', [
      { uri: 'file:///z.txt', name: 'z.txt' },
    ])
    mockManager.setResources('alpha', [
      { uri: 'file:///a.txt', name: 'a.txt' },
    ])
    mockManager.setResources('beta', [
      { uri: 'file:///b.txt', name: 'b.txt' },
    ])

    const result = await listMcpResources({}, mockManager as any)

    const data = JSON.parse(result.content)
    expect(data.resources[0].server).toBe('alpha')
    expect(data.resources[1].server).toBe('beta')
    expect(data.resources[2].server).toBe('zebra')
  })
})

describe('Provider-Specific Tool Pack Usage', () => {
  it('INT-16: resolveTools handles pack name string', () => {
    const tools = resolveTools('core-codex')

    expect(Array.isArray(tools)).toBe(true)
    expect(tools).toContain('exec')
  })

  it('INT-17: resolveTools handles explicit array', () => {
    const tools = resolveTools(['readFile', 'listDir'])

    expect(tools).toEqual(['readFile', 'listDir'])
  })

  it('INT-18: resolveTools handles null for all tools', () => {
    const tools = resolveTools(null)

    expect(tools).toBeNull()
  })

  it('INT-19: hasToolPack validates pack existence', () => {
    expect(hasToolPack('core-codex')).toBe(true)
    expect(hasToolPack('anthropic-standard')).toBe(true)
    expect(hasToolPack('file-ops')).toBe(true)
    expect(hasToolPack('nonexistent')).toBe(false)
  })

  it('INT-20: tool registry is accessible for all default packs', () => {
    const registry = new ToolRegistry()
    const packs = ['core-codex', 'anthropic-standard', 'file-ops']

    for (const packName of packs) {
      const tools = getToolsFromPack(packName)!
      for (const toolName of tools) {
        expect(registry.has(toolName)).toBe(true)
      }
    }
  })
})

// Mock MCP Connection Manager for testing
class MockMcpConnectionManager {
  private resources: Record<string, McpResource[]> = {}
  private templates: Record<string, McpResourceTemplate[]> = {}
  private resourceContents: Record<string, any> = {}
  private cursors: Record<string, string> = {}
  public lastCursor?: string

  setResources(server: string, resources: McpResource[]) {
    this.resources[server] = resources
  }

  setResourcesWithCursor(server: string, resources: McpResource[], cursor: string) {
    this.resources[server] = resources
    this.cursors[server] = cursor
  }

  setTemplates(server: string, templates: McpResourceTemplate[]) {
    this.templates[server] = templates
  }

  setResourceContent(server: string, uri: string, contents: any[]) {
    this.resourceContents[`${server}::${uri}`] = contents
  }

  async listResources(
    serverName: string,
    params?: { cursor?: string },
  ): Promise<ListResourcesResult> {
    this.lastCursor = params?.cursor
    return {
      resources: this.resources[serverName] || [],
      nextCursor: this.cursors[serverName],
    }
  }

  async listAllResources(): Promise<Record<string, McpResource[]>> {
    return this.resources
  }

  async listResourceTemplates(
    serverName: string,
    _params?: { cursor?: string },
  ): Promise<ListResourceTemplatesResult> {
    return {
      resourceTemplates: this.templates[serverName] || [],
      nextCursor: undefined,
    }
  }

  async listAllResourceTemplates(): Promise<
    Record<string, McpResourceTemplate[]>
  > {
    return this.templates
  }

  async readResource(
    serverName: string,
    uri: string,
  ): Promise<ReadResourceResult> {
    const key = `${serverName}::${uri}`
    if (key in this.resourceContents) {
      return {
        contents: this.resourceContents[key],
      }
    }
    throw new Error(
      `MCP resource reading not yet implemented (connection manager stubbed): ${serverName}::${uri}`,
    )
  }
}
