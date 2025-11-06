/**
 * Tests for pull progress reporters
 *
 * Ported from codex-rs/ollama/src/pull.rs
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CliProgressReporter, TuiProgressReporter } from './pull.js'
import type { PullEvent } from './parser.js'

describe('CliProgressReporter', () => {
  let stderrWrite: typeof process.stderr.write
  let writtenOutput: string[]

  beforeEach(() => {
    writtenOutput = []
    stderrWrite = process.stderr.write
    // Mock stderr.write to capture output
    process.stderr.write = vi.fn((chunk: any) => {
      writtenOutput.push(String(chunk))
      return true
    }) as any
  })

  afterEach(() => {
    process.stderr.write = stderrWrite
  })

  it('should handle status events', () => {
    const reporter = new CliProgressReporter()
    const event: PullEvent = { type: 'status', status: 'verifying' }

    reporter.onEvent(event)

    expect(writtenOutput.length).toBeGreaterThan(0)
    expect(writtenOutput.join('')).toContain('verifying')
  })

  it('should skip "pulling manifest" status', () => {
    const reporter = new CliProgressReporter()
    const event: PullEvent = { type: 'status', status: 'pulling manifest' }

    reporter.onEvent(event)

    expect(writtenOutput.length).toBe(0)
  })

  it('should handle chunk progress events', () => {
    const reporter = new CliProgressReporter()
    const event: PullEvent = {
      type: 'chunk_progress',
      digest: 'sha256:abc',
      total: 1024 * 1024 * 1024, // 1 GB
      completed: 512 * 1024 * 1024, // 512 MB
    }

    reporter.onEvent(event)

    // Should print header and progress
    expect(writtenOutput.length).toBeGreaterThan(0)
    const output = writtenOutput.join('')
    expect(output).toContain('Downloading model')
    expect(output).toContain('GB')
  })

  it('should aggregate progress across multiple digests', () => {
    const reporter = new CliProgressReporter()

    // First digest
    reporter.onEvent({
      type: 'chunk_progress',
      digest: 'sha256:abc',
      total: 1024 * 1024 * 1024, // 1 GB
      completed: 512 * 1024 * 1024, // 512 MB
    })

    writtenOutput = [] // Clear output

    // Second digest
    reporter.onEvent({
      type: 'chunk_progress',
      digest: 'sha256:def',
      total: 1024 * 1024 * 1024, // 1 GB
      completed: 256 * 1024 * 1024, // 256 MB
    })

    const output = writtenOutput.join('')
    // Total should be ~2 GB, completed ~768 MB
    expect(output).toContain('GB')
  })

  it('should handle success events', () => {
    const reporter = new CliProgressReporter()
    const event: PullEvent = { type: 'success' }

    reporter.onEvent(event)

    expect(writtenOutput.length).toBeGreaterThan(0)
    expect(writtenOutput.join('')).toContain('\n')
  })

  it('should not print errors (handled by caller)', () => {
    const reporter = new CliProgressReporter()
    const event: PullEvent = { type: 'error', message: 'Test error' }

    reporter.onEvent(event)

    // Should not write anything for errors
    expect(writtenOutput.length).toBe(0)
  })

  it('should update progress with download speed', () => {
    const reporter = new CliProgressReporter()

    // First update
    reporter.onEvent({
      type: 'chunk_progress',
      digest: 'sha256:abc',
      total: 100 * 1024 * 1024, // 100 MB
      completed: 50 * 1024 * 1024, // 50 MB
    })

    writtenOutput = []

    // Wait a bit and update again
    reporter.onEvent({
      type: 'chunk_progress',
      digest: 'sha256:abc',
      total: 100 * 1024 * 1024, // 100 MB
      completed: 75 * 1024 * 1024, // 75 MB
    })

    const output = writtenOutput.join('')
    // Should show MB/s speed
    expect(output).toContain('MB/s')
  })
})

describe('TuiProgressReporter', () => {
  let stderrWrite: typeof process.stderr.write

  beforeEach(() => {
    stderrWrite = process.stderr.write
    process.stderr.write = vi.fn(() => true) as any
  })

  afterEach(() => {
    process.stderr.write = stderrWrite
  })

  it('should delegate to CLI reporter', () => {
    const reporter = new TuiProgressReporter()
    const event: PullEvent = { type: 'status', status: 'downloading' }

    // Should not throw
    expect(() => reporter.onEvent(event)).not.toThrow()

    // Should have called stderr.write (via CLI reporter)
    expect(process.stderr.write).toHaveBeenCalled()
  })

  it('should handle all event types', () => {
    const reporter = new TuiProgressReporter()

    const events: PullEvent[] = [
      { type: 'status', status: 'verifying' },
      {
        type: 'chunk_progress',
        digest: 'sha256:abc',
        total: 1024,
        completed: 512,
      },
      { type: 'success' },
    ]

    for (const event of events) {
      expect(() => reporter.onEvent(event)).not.toThrow()
    }
  })
})
