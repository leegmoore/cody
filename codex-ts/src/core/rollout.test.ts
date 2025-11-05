/**
 * Tests for rollout persistence and discovery.
 *
 * Tests the JSONL-based rollout recorder including file creation, writing,
 * reading, listing, archiving, and deletion of conversation rollouts.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs/promises'
import * as path from 'path'
import * as os from 'os'
import {
  RolloutRecorder,
  SessionSource,
  SESSIONS_SUBDIR,
  ARCHIVED_SESSIONS_SUBDIR,
  type RolloutRecorderParams,
  type RolloutItem,
  type SessionMeta,
} from './rollout.js'
import { Config } from './config.js'
import { ConversationId } from '../protocol/conversation-id/index.js'

describe('rollout', () => {
  let testConfig: Config
  let testCodexHome: string

  beforeEach(async () => {
    // Create a temporary directory for testing
    testCodexHome = await fs.mkdtemp(path.join(os.tmpdir(), 'codex-rollout-test-'))

    // Create a minimal test config
    testConfig = {
      codexHome: testCodexHome,
      cwd: '/test/cwd',
      modelProviderId: 'test-provider',
    } as Config
  })

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testCodexHome, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('RolloutRecorder.create', () => {
    it('should create new rollout file', async () => {
      const conversationId = ConversationId.new()
      const params: RolloutRecorderParams = {
        type: 'create',
        conversationId,
        instructions: 'Test instructions',
        source: SessionSource.CLI,
      }

      const recorder = await RolloutRecorder.create(testConfig, params)
      const rolloutPath = recorder.getRolloutPath()

      expect(rolloutPath).toBeDefined()

      // Verify file exists
      const exists = await fs
        .access(rolloutPath)
        .then(() => true)
        .catch(() => false)
      expect(exists).toBe(true)
    })

    it('should create directory structure YYYY/MM/DD', async () => {
      const conversationId = ConversationId.new()
      const params: RolloutRecorderParams = {
        type: 'create',
        conversationId,
        source: SessionSource.CLI,
      }

      const recorder = await RolloutRecorder.create(testConfig, params)
      const rolloutPath = recorder.getRolloutPath()

      const now = new Date()
      const year = now.getFullYear().toString()
      const month = (now.getMonth() + 1).toString().padStart(2, '0')
      const day = now.getDate().toString().padStart(2, '0')

      expect(rolloutPath).toContain(path.join(SESSIONS_SUBDIR, year, month, day))
    })

    it('should write session meta as first line', async () => {
      const conversationId = ConversationId.new()
      const instructions = 'Build a feature'
      const params: RolloutRecorderParams = {
        type: 'create',
        conversationId,
        instructions,
        source: SessionSource.VSCode,
      }

      const recorder = await RolloutRecorder.create(testConfig, params)
      const lines = await RolloutRecorder.readRolloutHistory(recorder.getRolloutPath())

      expect(lines).toHaveLength(1)
      expect(lines[0].item.type).toBe('session_meta')

      const meta = lines[0].item.data as SessionMeta
      expect(meta.id).toBe(conversationId.toString())
      expect(meta.instructions).toBe(instructions)
      expect(meta.source).toBe(SessionSource.VSCode)
      expect(meta.cwd).toBe(testConfig.cwd)
    })

    it('should resume from existing file', async () => {
      // Create a test file
      const conversationId = ConversationId.new()
      const createParams: RolloutRecorderParams = {
        type: 'create',
        conversationId,
        source: SessionSource.CLI,
      }

      const recorder1 = await RolloutRecorder.create(testConfig, createParams)
      const filePath = recorder1.getRolloutPath()

      // Write some items
      await recorder1.recordItems([
        { type: 'message', data: { text: 'Hello' } },
      ])

      // Resume from the file
      const resumeParams: RolloutRecorderParams = {
        type: 'resume',
        path: filePath,
      }

      const recorder2 = await RolloutRecorder.create(testConfig, resumeParams)
      expect(recorder2.getRolloutPath()).toBe(filePath)

      // Should be able to read existing content
      const lines = await RolloutRecorder.readRolloutHistory(filePath)
      expect(lines.length).toBeGreaterThanOrEqual(2) // meta + message
    })

    it('should throw error when resuming non-existent file', async () => {
      const params: RolloutRecorderParams = {
        type: 'resume',
        path: path.join(testCodexHome, 'non-existent.jsonl'),
      }

      await expect(RolloutRecorder.create(testConfig, params)).rejects.toThrow()
    })
  })

  describe('recordItems', () => {
    it('should record items to file', async () => {
      const conversationId = ConversationId.new()
      const recorder = await RolloutRecorder.create(testConfig, {
        type: 'create',
        conversationId,
        source: SessionSource.CLI,
      })

      const items: RolloutItem[] = [
        { type: 'message', data: { text: 'First message' } },
        { type: 'response', data: { text: 'First response' } },
        { type: 'message', data: { text: 'Second message' } },
      ]

      await recorder.recordItems(items)

      const lines = await RolloutRecorder.readRolloutHistory(recorder.getRolloutPath())

      // Should have meta + 3 items
      expect(lines.length).toBe(4)
      expect(lines[1].item.type).toBe('message')
      expect(lines[2].item.type).toBe('response')
      expect(lines[3].item.type).toBe('message')
    })

    it('should handle empty items array', async () => {
      const conversationId = ConversationId.new()
      const recorder = await RolloutRecorder.create(testConfig, {
        type: 'create',
        conversationId,
        source: SessionSource.CLI,
      })

      await recorder.recordItems([])

      const lines = await RolloutRecorder.readRolloutHistory(recorder.getRolloutPath())
      expect(lines).toHaveLength(1) // Only meta
    })

    it('should write valid JSONL format', async () => {
      const conversationId = ConversationId.new()
      const recorder = await RolloutRecorder.create(testConfig, {
        type: 'create',
        conversationId,
        source: SessionSource.CLI,
      })

      await recorder.recordItems([
        { type: 'message', data: { text: 'Test' } },
      ])

      const content = await fs.readFile(recorder.getRolloutPath(), 'utf8')
      const lines = content.split('\n').filter((l) => l.trim())

      // Each line should be valid JSON
      lines.forEach((line) => {
        expect(() => JSON.parse(line)).not.toThrow()
      })
    })
  })

  describe('readRolloutHistory', () => {
    it('should read rollout history from file', async () => {
      const conversationId = ConversationId.new()
      const recorder = await RolloutRecorder.create(testConfig, {
        type: 'create',
        conversationId,
        instructions: 'Test',
        source: SessionSource.CLI,
      })

      await recorder.recordItems([
        { type: 'message', data: { text: 'Hello' } },
        { type: 'response', data: { text: 'World' } },
      ])

      const lines = await RolloutRecorder.readRolloutHistory(recorder.getRolloutPath())

      expect(lines).toHaveLength(3) // meta + 2 items
      expect(lines[0].item.type).toBe('session_meta')
      expect(lines[1].item.data.text).toBe('Hello')
      expect(lines[2].item.data.text).toBe('World')
    })

    it('should return empty array for empty file', async () => {
      const emptyFile = path.join(testCodexHome, 'empty.jsonl')
      await fs.writeFile(emptyFile, '', 'utf8')

      const lines = await RolloutRecorder.readRolloutHistory(emptyFile)
      expect(lines).toEqual([])
    })

    it('should skip invalid JSON lines', async () => {
      const testFile = path.join(testCodexHome, 'mixed.jsonl')
      await fs.writeFile(
        testFile,
        '{"timestamp":"2025-01-01T00:00:00.000Z","item":{"type":"message","data":{"text":"valid"}}}\n' +
          'invalid json line\n' +
          '{"timestamp":"2025-01-01T00:00:01.000Z","item":{"type":"message","data":{"text":"also valid"}}}\n',
        'utf8',
      )

      const lines = await RolloutRecorder.readRolloutHistory(testFile)
      expect(lines).toHaveLength(2)
      expect(lines[0].item.data.text).toBe('valid')
      expect(lines[1].item.data.text).toBe('also valid')
    })

    it('should include timestamps in each line', async () => {
      const conversationId = ConversationId.new()
      const recorder = await RolloutRecorder.create(testConfig, {
        type: 'create',
        conversationId,
        source: SessionSource.CLI,
      })

      await recorder.recordItems([{ type: 'message', data: { text: 'Test' } }])

      const lines = await RolloutRecorder.readRolloutHistory(recorder.getRolloutPath())

      lines.forEach((line) => {
        expect(line.timestamp).toBeDefined()
        expect(typeof line.timestamp).toBe('string')
        expect(() => new Date(line.timestamp)).not.toThrow()
      })
    })
  })

  describe('listConversations', () => {
    it('should return empty page when no conversations exist', async () => {
      const page = await RolloutRecorder.listConversations(testCodexHome)

      expect(page.items).toEqual([])
      expect(page.hasMore).toBe(false)
    })

    it('should list existing conversations', async () => {
      // Create multiple conversations
      const conv1 = ConversationId.new()
      const conv2 = ConversationId.new()

      await RolloutRecorder.create(testConfig, {
        type: 'create',
        conversationId: conv1,
        instructions: 'First conversation',
        source: SessionSource.CLI,
      })

      await RolloutRecorder.create(testConfig, {
        type: 'create',
        conversationId: conv2,
        instructions: 'Second conversation',
        source: SessionSource.VSCode,
      })

      const page = await RolloutRecorder.listConversations(testCodexHome)

      expect(page.items).toHaveLength(2)
      expect(page.hasMore).toBe(false)
    })

    it('should include conversation metadata', async () => {
      const conversationId = ConversationId.new()
      const instructions = 'Build a feature'

      await RolloutRecorder.create(testConfig, {
        type: 'create',
        conversationId,
        instructions,
        source: SessionSource.CLI,
      })

      const page = await RolloutRecorder.listConversations(testCodexHome)

      expect(page.items).toHaveLength(1)
      const item = page.items[0]
      expect(item.id).toBe(conversationId.toString())
      expect(item.meta?.instructions).toBe(instructions)
      expect(item.meta?.source).toBe(SessionSource.CLI)
      expect(item.createdAt).toBeDefined()
    })

    it('should respect limit parameter', async () => {
      // Create 5 conversations
      for (let i = 0; i < 5; i++) {
        await RolloutRecorder.create(testConfig, {
          type: 'create',
          conversationId: ConversationId.new(),
          source: SessionSource.CLI,
        })
      }

      const page = await RolloutRecorder.listConversations(testCodexHome, 3)

      expect(page.items).toHaveLength(3)
      expect(page.hasMore).toBe(true)
    })

    it('should sort conversations newest first', async () => {
      const conv1 = ConversationId.new()
      const recorder1 = await RolloutRecorder.create(testConfig, {
        type: 'create',
        conversationId: conv1,
        source: SessionSource.CLI,
      })

      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10))

      const conv2 = ConversationId.new()
      const recorder2 = await RolloutRecorder.create(testConfig, {
        type: 'create',
        conversationId: conv2,
        source: SessionSource.CLI,
      })

      const page = await RolloutRecorder.listConversations(testCodexHome)

      expect(page.items).toHaveLength(2)
      // conv2 should be first (newest)
      expect(page.items[0].id).toBe(conv2.toString())
      expect(page.items[1].id).toBe(conv1.toString())
    })
  })

  describe('findConversationPathById', () => {
    it('should find conversation by ID', async () => {
      const conversationId = ConversationId.new()
      const recorder = await RolloutRecorder.create(testConfig, {
        type: 'create',
        conversationId,
        source: SessionSource.CLI,
      })

      const foundPath = await RolloutRecorder.findConversationPathById(
        testCodexHome,
        conversationId.toString(),
      )

      expect(foundPath).toBe(recorder.getRolloutPath())
    })

    it('should return undefined for non-existent ID', async () => {
      const foundPath = await RolloutRecorder.findConversationPathById(
        testCodexHome,
        '00000000-0000-0000-0000-000000000000',
      )

      expect(foundPath).toBeUndefined()
    })

    it('should return undefined when sessions directory does not exist', async () => {
      const emptyHome = path.join(testCodexHome, 'empty')
      const foundPath = await RolloutRecorder.findConversationPathById(
        emptyHome,
        ConversationId.new().toString(),
      )

      expect(foundPath).toBeUndefined()
    })

    it('should find conversation in nested directories', async () => {
      const conversationId = ConversationId.new()
      await RolloutRecorder.create(testConfig, {
        type: 'create',
        conversationId,
        source: SessionSource.CLI,
      })

      // Should find it even though it's nested in YYYY/MM/DD
      const foundPath = await RolloutRecorder.findConversationPathById(
        testCodexHome,
        conversationId.toString(),
      )

      expect(foundPath).toBeDefined()
      expect(foundPath).toContain(conversationId.toString())
    })
  })

  describe('archiveConversation', () => {
    it('should move conversation to archived directory', async () => {
      const conversationId = ConversationId.new()
      const recorder = await RolloutRecorder.create(testConfig, {
        type: 'create',
        conversationId,
        source: SessionSource.CLI,
      })

      const originalPath = recorder.getRolloutPath()

      // Verify original exists
      await fs.access(originalPath)

      // Archive it
      const archivedPath = await RolloutRecorder.archiveConversation(testCodexHome, originalPath)

      // Verify archived file exists
      await fs.access(archivedPath)
      expect(archivedPath).toContain(ARCHIVED_SESSIONS_SUBDIR)

      // Verify original is gone
      const originalExists = await fs
        .access(originalPath)
        .then(() => true)
        .catch(() => false)
      expect(originalExists).toBe(false)
    })

    it('should preserve file content when archiving', async () => {
      const conversationId = ConversationId.new()
      const recorder = await RolloutRecorder.create(testConfig, {
        type: 'create',
        conversationId,
        instructions: 'Important data',
        source: SessionSource.CLI,
      })

      await recorder.recordItems([{ type: 'message', data: { text: 'Keep this!' } }])

      const originalPath = recorder.getRolloutPath()
      const archivedPath = await RolloutRecorder.archiveConversation(testCodexHome, originalPath)

      // Read archived content
      const lines = await RolloutRecorder.readRolloutHistory(archivedPath)
      expect(lines.length).toBeGreaterThan(0)
      expect(lines[1].item.data.text).toBe('Keep this!')
    })
  })

  describe('deleteConversation', () => {
    it('should delete conversation file', async () => {
      const conversationId = ConversationId.new()
      const recorder = await RolloutRecorder.create(testConfig, {
        type: 'create',
        conversationId,
        source: SessionSource.CLI,
      })

      const filePath = recorder.getRolloutPath()

      // Verify file exists
      await fs.access(filePath)

      // Delete it
      await RolloutRecorder.deleteConversation(filePath)

      // Verify it's gone
      const exists = await fs
        .access(filePath)
        .then(() => true)
        .catch(() => false)
      expect(exists).toBe(false)
    })

    it('should throw error when deleting non-existent file', async () => {
      const nonExistentPath = path.join(testCodexHome, 'does-not-exist.jsonl')

      await expect(RolloutRecorder.deleteConversation(nonExistentPath)).rejects.toThrow()
    })
  })

  describe('flush and shutdown', () => {
    it('should flush without error', async () => {
      const conversationId = ConversationId.new()
      const recorder = await RolloutRecorder.create(testConfig, {
        type: 'create',
        conversationId,
        source: SessionSource.CLI,
      })

      await expect(recorder.flush()).resolves.not.toThrow()
    })

    it('should shutdown without error', async () => {
      const conversationId = ConversationId.new()
      const recorder = await RolloutRecorder.create(testConfig, {
        type: 'create',
        conversationId,
        source: SessionSource.CLI,
      })

      await expect(recorder.shutdown()).resolves.not.toThrow()
    })
  })

  describe('integration', () => {
    it('should handle complete conversation lifecycle', async () => {
      // Create conversation
      const conversationId = ConversationId.new()
      const recorder = await RolloutRecorder.create(testConfig, {
        type: 'create',
        conversationId,
        instructions: 'Build a todo app',
        source: SessionSource.VSCode,
      })

      // Record multiple items
      await recorder.recordItems([
        { type: 'message', data: { text: 'Create React component' } },
        { type: 'response', data: { text: 'Here is your component' } },
        { type: 'message', data: { text: 'Add TypeScript types' } },
        { type: 'response', data: { text: 'Types added' } },
      ])

      await recorder.flush()

      // List conversations
      const page = await RolloutRecorder.listConversations(testCodexHome)
      expect(page.items).toHaveLength(1)
      expect(page.items[0].id).toBe(conversationId.toString())

      // Find by ID
      const foundPath = await RolloutRecorder.findConversationPathById(
        testCodexHome,
        conversationId.toString(),
      )
      expect(foundPath).toBe(recorder.getRolloutPath())

      // Read history
      const lines = await RolloutRecorder.readRolloutHistory(recorder.getRolloutPath())
      expect(lines.length).toBe(5) // meta + 4 items

      // Archive
      const archivedPath = await RolloutRecorder.archiveConversation(
        testCodexHome,
        recorder.getRolloutPath(),
      )
      expect(archivedPath).toContain(ARCHIVED_SESSIONS_SUBDIR)

      // Verify archived content
      const archivedLines = await RolloutRecorder.readRolloutHistory(archivedPath)
      expect(archivedLines.length).toBe(5)
    })

    it('should handle multiple concurrent conversations', async () => {
      const conversations = []

      // Create 3 conversations
      for (let i = 0; i < 3; i++) {
        const conversationId = ConversationId.new()
        const recorder = await RolloutRecorder.create(testConfig, {
          type: 'create',
          conversationId,
          instructions: `Conversation ${i}`,
          source: SessionSource.CLI,
        })

        await recorder.recordItems([
          { type: 'message', data: { text: `Message ${i}` } },
        ])

        conversations.push({ id: conversationId, recorder })
      }

      // List all conversations
      const page = await RolloutRecorder.listConversations(testCodexHome)
      expect(page.items).toHaveLength(3)

      // Find each conversation
      for (const conv of conversations) {
        const foundPath = await RolloutRecorder.findConversationPathById(
          testCodexHome,
          conv.id.toString(),
        )
        expect(foundPath).toBe(conv.recorder.getRolloutPath())
      }
    })

    it('should preserve data integrity across operations', async () => {
      const conversationId = ConversationId.new()
      const instructions = 'Build complex feature'
      const testData = {
        message1: 'First message with special chars: "quotes", newlines\n, and\ttabs',
        message2: 'Unicode: 你好世界 🚀',
        message3: 'Very long message ' + 'x'.repeat(1000),
      }

      // Create and write
      const recorder = await RolloutRecorder.create(testConfig, {
        type: 'create',
        conversationId,
        instructions,
        source: SessionSource.API,
      })

      await recorder.recordItems([
        { type: 'message', data: { text: testData.message1 } },
        { type: 'message', data: { text: testData.message2 } },
        { type: 'message', data: { text: testData.message3 } },
      ])

      // Read back
      const lines = await RolloutRecorder.readRolloutHistory(recorder.getRolloutPath())
      expect(lines[1].item.data.text).toBe(testData.message1)
      expect(lines[2].item.data.text).toBe(testData.message2)
      expect(lines[3].item.data.text).toBe(testData.message3)

      // List and verify metadata
      const page = await RolloutRecorder.listConversations(testCodexHome)
      expect(page.items[0].meta?.instructions).toBe(instructions)
      expect(page.items[0].meta?.source).toBe(SessionSource.API)
    })
  })
})
