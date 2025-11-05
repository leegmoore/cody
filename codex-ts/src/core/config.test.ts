import { describe, it, expect } from 'vitest'
import { Config, History, HistoryPersistence, UriBasedFileOpener } from './config'
import { AskForApproval, SandboxPolicy } from '../protocol/protocol'
import { ReasoningSummary } from '../protocol/config-types'

describe('Config', () => {
  describe('History', () => {
    it('should have correct default persistence', () => {
      const history = History.defaultHistory()
      expect(history.persistence).toBe(HistoryPersistence.SaveAll)
      expect(history.maxBytes).toBeUndefined()
    })

    it('should support SaveAll persistence mode', () => {
      const history: History = {
        persistence: HistoryPersistence.SaveAll,
        maxBytes: undefined,
      }
      expect(history.persistence).toBe(HistoryPersistence.SaveAll)
    })

    it('should support None persistence mode', () => {
      const history: History = {
        persistence: HistoryPersistence.None,
        maxBytes: undefined,
      }
      expect(history.persistence).toBe(HistoryPersistence.None)
    })

    it('should support optional max_bytes', () => {
      const history: History = {
        persistence: HistoryPersistence.SaveAll,
        maxBytes: 1024 * 1024, // 1MB
      }
      expect(history.maxBytes).toBe(1024 * 1024)
    })
  })

  describe('UriBasedFileOpener', () => {
    it('should support VSCode scheme', () => {
      expect(UriBasedFileOpener.getScheme(UriBasedFileOpener.VsCode)).toBe('vscode')
    })

    it('should support VSCode Insiders scheme', () => {
      expect(UriBasedFileOpener.getScheme(UriBasedFileOpener.VsCodeInsiders)).toBe(
        'vscode-insiders',
      )
    })

    it('should support Windsurf scheme', () => {
      expect(UriBasedFileOpener.getScheme(UriBasedFileOpener.Windsurf)).toBe('windsurf')
    })

    it('should support Cursor scheme', () => {
      expect(UriBasedFileOpener.getScheme(UriBasedFileOpener.Cursor)).toBe('cursor')
    })

    it('should return undefined for None', () => {
      expect(UriBasedFileOpener.getScheme(UriBasedFileOpener.None)).toBeUndefined()
    })
  })

  describe('Config defaults', () => {
    it('should create config with required defaults', () => {
      const config = Config.createDefault('/home/user/.codex', '/home/user/project')

      expect(config.codexHome).toBe('/home/user/.codex')
      expect(config.cwd).toBe('/home/user/project')
      expect(config.model).toBe('gpt-5-codex')
      expect(config.reviewModel).toBe('gpt-5-codex')
      expect(config.modelProviderId).toBe('openai')
      expect(config.approvalPolicy).toBe('on-failure')
      expect(config.history.persistence).toBe(HistoryPersistence.SaveAll)
      expect(config.fileOpener).toBe(UriBasedFileOpener.None)
      expect(config.hideAgentReasoning).toBe(false)
      expect(config.showRawAgentReasoning).toBe(false)
      expect(config.modelReasoningSummary).toBe(ReasoningSummary.Auto)
      expect(config.chatgptBaseUrl).toBe('https://chatgpt.com/backend-api/')
    })

    it('should set correct sandbox policy default', () => {
      const config = Config.createDefault('/home/user/.codex', '/home/user/project')

      // Default is read-only policy
      expect(config.sandboxPolicy.mode).toBe('read-only')
    })

    it('should initialize empty MCP servers map', () => {
      const config = Config.createDefault('/home/user/.codex', '/home/user/project')

      expect(config.mcpServers).toEqual(new Map())
    })

    it('should set project doc defaults', () => {
      const config = Config.createDefault('/home/user/.codex', '/home/user/project')

      expect(config.projectDocMaxBytes).toBe(32 * 1024) // 32 KiB
      expect(config.projectDocFallbackFilenames).toEqual([])
    })
  })

  describe('Config creation with custom values', () => {
    it('should allow custom model', () => {
      const config = Config.createDefault('/home/user/.codex', '/home/user/project')
      config.model = 'gpt-4'

      expect(config.model).toBe('gpt-4')
    })

    it('should allow custom approval policy', () => {
      const config = Config.createDefault('/home/user/.codex', '/home/user/project')
      config.approvalPolicy = 'never'

      expect(config.approvalPolicy).toBe('never')
    })

    it('should allow disabling history persistence', () => {
      const config = Config.createDefault('/home/user/.codex', '/home/user/project')
      config.history = {
        persistence: HistoryPersistence.None,
        maxBytes: undefined,
      }

      expect(config.history.persistence).toBe(HistoryPersistence.None)
    })
  })

  describe('Config validation', () => {
    it('should require codex_home path', () => {
      expect(() => {
        Config.createDefault('', '/home/user/project')
      }).toThrow()
    })

    it('should require cwd path', () => {
      expect(() => {
        Config.createDefault('/home/user/.codex', '')
      }).toThrow()
    })
  })
})
