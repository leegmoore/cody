import { describe, it, expect } from 'vitest'
import { safeFormatKey } from './index'

describe('safeFormatKey', () => {
  it('should format long key safely', () => {
    const key = 'sk-proj-1234567890ABCDE'
    expect(safeFormatKey(key)).toBe('sk-proj-***ABCDE')
  })

  it('should return stars for short key', () => {
    const key = 'sk-proj-12345'
    expect(safeFormatKey(key)).toBe('***')
  })

  it('should handle exactly 13 characters', () => {
    const key = 'abcdefghijklm' // 13 chars
    expect(safeFormatKey(key)).toBe('***')
  })

  it('should handle exactly 14 characters', () => {
    const key = 'abcdefghijklmn' // 14 chars
    expect(safeFormatKey(key)).toBe('abcdefgh***jklmn')
  })

  it('should handle empty string', () => {
    const key = ''
    expect(safeFormatKey(key)).toBe('***')
  })

  it('should handle very long key', () => {
    const key = 'sk-proj-' + 'x'.repeat(100)
    const formatted = safeFormatKey(key)
    expect(formatted).toBe('sk-proj-***' + 'x'.repeat(5))
    expect(formatted).toContain('***')
    expect(formatted.length).toBeLessThan(key.length)
  })
})
