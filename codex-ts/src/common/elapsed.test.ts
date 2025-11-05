import { describe, it, expect } from 'vitest';
import { formatDuration } from './elapsed.js';

describe('formatDuration', () => {
  it('formats subsecond durations in milliseconds', () => {
    // Durations < 1s should be rendered in milliseconds with no decimals
    expect(formatDuration(250)).toBe('250ms');
    expect(formatDuration(0)).toBe('0ms');
    expect(formatDuration(999)).toBe('999ms');
  });

  it('formats durations in seconds with 2 decimal places', () => {
    // Durations between 1s (inclusive) and 60s (exclusive) should be
    // printed with 2-decimal-place seconds
    expect(formatDuration(1500)).toBe('1.50s');
    expect(formatDuration(1000)).toBe('1.00s');

    // 59.999s rounds to 60.00s
    expect(formatDuration(59999)).toBe('60.00s');
  });

  it('formats durations in minutes and seconds', () => {
    // Durations ≥ 1 minute should be printed as "Xm YYs"
    expect(formatDuration(75000)).toBe('1m 15s'); // 1m15s
    expect(formatDuration(60000)).toBe('1m 00s'); // 1m0s
    expect(formatDuration(3601000)).toBe('60m 01s');
  });

  it('formats one hour correctly', () => {
    expect(formatDuration(3600000)).toBe('60m 00s');
  });

  it('formats various edge cases', () => {
    expect(formatDuration(1)).toBe('1ms');
    expect(formatDuration(1001)).toBe('1.00s');
    expect(formatDuration(59000)).toBe('59.00s');
    expect(formatDuration(60001)).toBe('1m 00s');
    expect(formatDuration(125000)).toBe('2m 05s');
  });
});
